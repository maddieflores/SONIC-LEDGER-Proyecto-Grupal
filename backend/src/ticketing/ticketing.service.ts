import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'node:crypto';
import qrcode from 'qrcode';
import {
  OrdenCompra,
  OrdenEstado,
  ReembolsoEstado,
} from './orden-compra.entity.js';
import { OrdenItem } from './orden-item.entity.js';
import { ReservaCupo } from './reserva-cupo.entity.js';
import {
  Ticket,
  TicketEstado,
} from './ticket.entity.js';
import {
  Reembolso,
  ReembolsoEstadoOperacion,
  ReembolsoTipo,
} from './reembolso.entity.js';
import { ConciertoVerificador } from './concierto-verificador.entity.js';
import {
  TicketValidacion,
  ValidacionResultado,
} from './ticket-validacion.entity.js';
import {
  Concierto,
  ConciertoEstado,
} from '../conciertos/concierto.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { RolNombre } from '../auth/rol.entity.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { SandboxGatewayService } from '../sandbox-gateway/sandbox-gateway.service.js';
import {
  AssignVerifierDto,
  CreateOrderDto,
  ProcessPaymentDto,
  ProcesarReembolsoSimuladoDto,
  SolicitarReembolsoDto,
  ValidateQrDto,
} from './ticketing.dto.js';

@Injectable()
export class TicketingService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(OrdenCompra)
    private readonly ordenesRepo: Repository<OrdenCompra>,
    @InjectRepository(OrdenItem)
    private readonly ordenItemsRepo: Repository<OrdenItem>,
    @InjectRepository(ReservaCupo)
    private readonly reservasRepo: Repository<ReservaCupo>,
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(ConciertoVerificador)
    private readonly verificadoresRepo: Repository<ConciertoVerificador>,
    @InjectRepository(TicketValidacion)
    private readonly validacionesRepo: Repository<TicketValidacion>,
    @InjectRepository(Concierto)
    private readonly conciertosRepo: Repository<Concierto>,
    @InjectRepository(ConciertoCategoria)
    private readonly categoriasRepo: Repository<ConciertoCategoria>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    private readonly paymentProvider: MockPaymentProvider,
    @Optional()
    @InjectRepository(Reembolso)
    reembolsosRepo?: Repository<Reembolso>,
    @Optional()
    sandboxGatewayService?: SandboxGatewayService,
  ) {
    this.reembolsosRepo = (reembolsosRepo ||
      (this.dataSource?.getRepository
        ? this.dataSource.getRepository(Reembolso)
        : ({} as any))) as Repository<Reembolso>;
    this.sandboxGatewayService =
      sandboxGatewayService || new SandboxGatewayService();
  }

  private readonly reembolsosRepo!: Repository<Reembolso>;
  private readonly sandboxGatewayService!: SandboxGatewayService;

  // 1. Liberar reservas expiradas automáticamente
  async liberarReservasExpiradas(): Promise<number> {
    const ahora = new Date();
    const reservasExpiradas = await this.reservasRepo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.orden', 'o')
      .where('r.expira_en < :ahora', { ahora })
      .andWhere('r.liberada = false')
      .andWhere('r.confirmada = false')
      .andWhere('o.estado = :pendiente', { pendiente: OrdenEstado.PENDIENTE })
      .getMany();

    if (reservasExpiradas.length === 0) return 0;

    let totalLiberadas = 0;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      for (const res of reservasExpiradas) {
        await queryRunner.manager
          .createQueryBuilder(ConciertoCategoria, 'cat')
          .update()
          .set({
            cupoDisponible: () => `cupo_disponible + ${res.cantidad}`,
          })
          .where('id = :catId', { catId: res.categoriaId })
          .execute();

        res.liberada = true;
        await queryRunner.manager.save(ReservaCupo, res);

        res.orden.estado = OrdenEstado.EXPIRADA;
        await queryRunner.manager.save(OrdenCompra, res.orden);
        totalLiberadas++;
      }
      await queryRunner.commitTransaction();
      return totalLiberadas;
    } catch (e) {
      await queryRunner.rollbackTransaction();
      return 0;
    } finally {
      await queryRunner.release();
    }
  }

  // 2. Crear reserva temporal y orden de compra (CU20)
  async crearReservaOrden(userId: string, dto: CreateOrderDto) {
    await this.liberarReservasExpiradas();

    // Idempotencia: si viene operacionId y ya existe orden pendiente del usuario, retornarla
    if (dto.operacionId) {
      const existente = await this.ordenesRepo.findOne({
        where: {
          operacionId: dto.operacionId,
          usuarioId: userId,
          estado: OrdenEstado.PENDIENTE,
        },
        relations: {
          items: { categoria: true },
          concierto: true,
        },
      });
      if (existente && new Date(existente.expiraEn).getTime() > Date.now()) {
        return this.mapOrden(existente);
      }
    }

    const concierto = await this.conciertosRepo.findOne({
      where: { id: dto.conciertoId },
    });

    if (!concierto) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    if (concierto.estado !== ConciertoEstado.PUBLICADO) {
      throw new BadRequestException(
        'Solo se pueden adquirir entradas de conciertos publicados.',
      );
    }

    const now = new Date();
    if (concierto.inicioVenta && now < new Date(concierto.inicioVenta)) {
      throw new BadRequestException(
        'La venta de entradas para este concierto aún no ha iniciado.',
      );
    }

    if (now > new Date(concierto.fechaFin)) {
      throw new BadRequestException(
        'La venta de entradas para este concierto ha finalizado.',
      );
    }

    // Transacción atómica con bloqueo pesimista en PostgreSQL
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloquear la fila de la categoría para evitar sobreventa concurrente
      const categoria = await queryRunner.manager
        .createQueryBuilder(ConciertoCategoria, 'cat')
        .setLock('pessimistic_write')
        .where('cat.id = :catId AND cat.concierto_id = :conciertoId', {
          catId: dto.categoriaId,
          conciertoId: dto.conciertoId,
        })
        .getOne();

      if (!categoria) {
        throw new NotFoundException('Categoría no encontrada en este concierto.');
      }

      if (!categoria.disponible) {
        throw new BadRequestException('Esta categoría no está disponible para la venta.');
      }

      if (categoria.cupoDisponible < dto.cantidad) {
        throw new BadRequestException(
          `No hay suficientes cupos disponibles en la categoría "${categoria.nombre}". Cupo restante: ${categoria.cupoDisponible}.`,
        );
      }

      // Descontar cupo reservado de forma atómica
      categoria.cupoDisponible -= dto.cantidad;
      await queryRunner.manager.save(ConciertoCategoria, categoria);

      const precioUnitario = Number(categoria.precio);
      const total = precioUnitario * dto.cantidad;
      const expiraEn = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos
      const operacionId = dto.operacionId || `OP-${randomUUID()}`;

      const orden = queryRunner.manager.create(OrdenCompra, {
        usuarioId: userId,
        conciertoId: dto.conciertoId,
        estado: OrdenEstado.PENDIENTE,
        total,
        moneda: 'BOB',
        expiraEn,
        operacionId,
        proveedorPago: 'MOCK',
      });
      const ordenGuardada = await queryRunner.manager.save(OrdenCompra, orden);

      const item = queryRunner.manager.create(OrdenItem, {
        ordenId: ordenGuardada.id,
        categoriaId: categoria.id,
        cantidad: dto.cantidad,
        precioUnitario,
        subtotal: total,
      });
      await queryRunner.manager.save(OrdenItem, item);

      const reserva = queryRunner.manager.create(ReservaCupo, {
        ordenId: ordenGuardada.id,
        categoriaId: categoria.id,
        cantidad: dto.cantidad,
        expiraEn,
        liberada: false,
        confirmada: false,
      });
      await queryRunner.manager.save(ReservaCupo, reserva);

      await queryRunner.commitTransaction();

      ordenGuardada.items = [item];
      item.categoria = categoria;
      ordenGuardada.concierto = concierto;

      return this.mapOrden(ordenGuardada);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 3. Procesar pago simulado y emitir tickets (CU20)
  async procesarPago(userId: string, dto: ProcessPaymentDto) {
    const orden = await this.ordenesRepo.findOne({
      where: { id: dto.ordenId },
      relations: {
        items: { categoria: true },
        concierto: true,
        tickets: { categoria: true, concierto: true },
      },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada.');
    }

    if (orden.usuarioId !== userId) {
      throw new ForbiddenException('No tienes permiso para pagar esta orden.');
    }

    // Si ya está confirmada, retornar tickets existentes (Idempotencia)
    if (orden.estado === OrdenEstado.CONFIRMADA) {
      const tickets = await this.obtenerTicketsConQr(orden.id);
      return {
        orden: this.mapOrden(orden),
        tickets,
      };
    }

    const ahora = new Date();
    if (
      orden.estado === OrdenEstado.EXPIRADA ||
      orden.estado === OrdenEstado.CANCELADA ||
      ahora > new Date(orden.expiraEn)
    ) {
      await this.liberarReservasExpiradas();
      throw new BadRequestException(
        'La reserva de esta orden ha expirado. Por favor selecciona tus entradas nuevamente.',
      );
    }

    // Llamar al MockPaymentProvider (PAGO DE PRUEBA)
    const paymentResult = await this.paymentProvider.processPayment(
      orden.id,
      Number(orden.total),
      { simulateStatus: dto.simularResultado },
    );

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Bloquear concierto para prevenir que se emitan tickets si el concierto fue cancelado concurrentemente
      const conciertoLock = await queryRunner.manager
        .createQueryBuilder(Concierto, 'c')
        .setLock('pessimistic_write')
        .where('c.id = :conciertoId', { conciertoId: orden.conciertoId })
        .getOne();

      if (!conciertoLock || conciertoLock.estado === ConciertoEstado.CANCELADO) {
        orden.estado = OrdenEstado.CANCELADA;
        orden.proveedorPago = paymentResult.provider;
        orden.pagoTransaccionId = paymentResult.transactionId;
        orden.pagoEstado = paymentResult.status;
        if (paymentResult.status === 'APROBADO') {
          orden.reembolsoEstado = ReembolsoEstado.PENDIENTE_REEMBOLSO;
        }
        await queryRunner.manager.save(OrdenCompra, orden);
        await queryRunner.commitTransaction();
        throw new BadRequestException(
          'El concierto ha sido cancelado por el organizador. La orden fue cancelada y no se emitieron tickets.',
        );
      }

      if (paymentResult.status === 'APROBADO') {
        orden.estado = OrdenEstado.CONFIRMADA;
        orden.proveedorPago = paymentResult.provider;
        orden.pagoTransaccionId = paymentResult.transactionId;
        orden.pagoEstado = paymentResult.status;
        orden.confirmadaEn = new Date();
        await queryRunner.manager.save(OrdenCompra, orden);

        // Confirmar reserva para que nunca sea liberada
        await queryRunner.manager
          .createQueryBuilder(ReservaCupo, 'r')
          .update()
          .set({ confirmada: true })
          .where('orden_id = :ordenId', { ordenId: orden.id })
          .execute();

        // Emitir exactamente UN ticket por cada unidad comprada
        const ticketsGenerados: Ticket[] = [];
        for (const it of orden.items || []) {
          for (let i = 0; i < it.cantidad; i++) {
            const codigoPublico = `SL-TK-${randomBytes(4).toString('hex').toUpperCase()}`;
            const qrToken = `SLQR_${randomBytes(32).toString('hex')}`;

            const ticket = queryRunner.manager.create(Ticket, {
              ordenId: orden.id,
              conciertoId: orden.conciertoId,
              categoriaId: it.categoriaId,
              usuarioId: userId,
              estado: TicketEstado.VIGENTE,
              codigoPublico,
              qrToken,
              fechaEmision: new Date(),
            });
            const tSaved = await queryRunner.manager.save(Ticket, ticket);
            tSaved.categoria = it.categoria;
            tSaved.concierto = orden.concierto;
            ticketsGenerados.push(tSaved);
          }
        }

        await queryRunner.commitTransaction();

        const ticketsConQr = await Promise.all(
          ticketsGenerados.map(async (t) => this.mapTicket(t, true)),
        );

        return {
          orden: this.mapOrden(orden),
          tickets: ticketsConQr,
        };
      } else if (paymentResult.status === 'RECHAZADO') {
        orden.estado = OrdenEstado.FALLIDA;
        orden.pagoEstado = 'RECHAZADO';
        await queryRunner.manager.save(OrdenCompra, orden);

        // Liberar cupos
        for (const it of orden.items || []) {
          await queryRunner.manager
            .createQueryBuilder(ConciertoCategoria, 'cat')
            .update()
            .set({
              cupoDisponible: () => `cupo_disponible + ${it.cantidad}`,
            })
            .where('id = :catId', { catId: it.categoriaId })
            .execute();
        }

        await queryRunner.manager
          .createQueryBuilder(ReservaCupo, 'r')
          .update()
          .set({ liberada: true })
          .where('orden_id = :ordenId', { ordenId: orden.id })
          .execute();

        await queryRunner.commitTransaction();

        throw new BadRequestException(
          'El pago simulado fue rechazado. No se emitieron entradas y se liberó el cupo.',
        );
      } else {
        // PENDIENTE
        orden.pagoEstado = 'PENDIENTE';
        await queryRunner.manager.save(OrdenCompra, orden);
        await queryRunner.commitTransaction();
        return {
          orden: this.mapOrden(orden),
          tickets: [],
        };
      }
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 4. Consultar orden específica
  async obtenerOrden(userId: string, ordenId: string) {
    const orden = await this.ordenesRepo.findOne({
      where: { id: ordenId },
      relations: {
        items: { categoria: true },
        concierto: true,
      },
    });

    if (!orden) {
      throw new NotFoundException('Orden no encontrada.');
    }

    if (orden.usuarioId !== userId) {
      throw new ForbiddenException('No tienes acceso a esta orden.');
    }

    return this.mapOrden(orden);
  }

  // 5. Mis Entradas y visualización de QR (CU21)
  async listarMisTickets(userId: string) {
    const tickets = await this.ticketsRepo.find({
      where: { usuarioId: userId },
      relations: {
        concierto: true,
        categoria: true,
      },
      order: { fechaEmision: 'DESC' },
    });

    return Promise.all(tickets.map((t) => this.mapTicket(t, true)));
  }

  async obtenerDetalleTicket(userId: string, ticketId: string) {
    const ticket = await this.ticketsRepo.findOne({
      where: { id: ticketId },
      relations: {
        concierto: true,
        categoria: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Ticket no encontrado.');
    }

    if (ticket.usuarioId !== userId) {
      throw new ForbiddenException('No tienes acceso a este ticket.');
    }

    return this.mapTicket(ticket, true);
  }

  // 6. Validar Ingreso mediante QR (CU22)
  async validarIngresoQR(verificadorUserId: string, dto: ValidateQrDto) {
    // 1. Verificar si el usuario está asignado y activo como verificador para este concierto
    const asignacion = await this.verificadoresRepo.findOne({
      where: {
        conciertoId: dto.conciertoId,
        usuarioId: verificadorUserId,
        activo: true,
      },
    });

    // Comprobar también si es ADMIN general de plataforma
    const usuario = await this.usuariosRepo.findOne({
      where: { id: verificadorUserId },
      relations: { roles: true },
    });
    const isAdmin = usuario?.roles?.some((r) => r.nombre === RolNombre.ADMIN);

    if (!asignacion && !isAdmin) {
      await this.validacionesRepo.save(
        this.validacionesRepo.create({
          conciertoId: dto.conciertoId,
          verificadorId: verificadorUserId,
          resultado: ValidacionResultado.NO_AUTORIZADO,
          motivo: 'Verificador no asignado a este concierto.',
        }),
      );

      return {
        valido: false,
        resultado: ValidacionResultado.NO_AUTORIZADO,
        mensaje: 'No tienes autorización asignada para validar entradas en este evento.',
      };
    }

    // Transacción atómica con bloqueo pesimista en PostgreSQL para evitar validación doble concurrente
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const ticket = await queryRunner.manager
        .createQueryBuilder(Ticket, 't')
        .setLock('pessimistic_write', undefined, ['t'])
        .innerJoinAndSelect('t.concierto', 'c')
        .innerJoinAndSelect('t.categoria', 'cat')
        .where('t.qr_token = :qrToken', { qrToken: dto.qrToken.trim() })
        .getOne();

      if (!ticket) {
        await queryRunner.manager.save(
          TicketValidacion,
          queryRunner.manager.create(TicketValidacion, {
            conciertoId: dto.conciertoId,
            verificadorId: verificadorUserId,
            resultado: ValidacionResultado.NO_ENCONTRADO,
            motivo: 'Código QR no reconocido o inexistente.',
          }),
        );
        await queryRunner.commitTransaction();

        return {
          valido: false,
          resultado: ValidacionResultado.NO_ENCONTRADO,
          mensaje: 'Código QR no reconocido o entrada inexistente.',
        };
      }

      // Comprobar que pertenece al concierto actual
      if (ticket.conciertoId !== dto.conciertoId) {
        await queryRunner.manager.save(
          TicketValidacion,
          queryRunner.manager.create(TicketValidacion, {
            ticketId: ticket.id,
            conciertoId: dto.conciertoId,
            verificadorId: verificadorUserId,
            resultado: ValidacionResultado.EVENTO_INCORRECTO,
            motivo: `Ticket pertenece a "${ticket.concierto?.titulo}".`,
          }),
        );
        await queryRunner.commitTransaction();

        return {
          valido: false,
          resultado: ValidacionResultado.EVENTO_INCORRECTO,
          mensaje: `Entrada inválida para este concierto. Corresponde a "${ticket.concierto?.titulo}".`,
          ticket: {
            codigoPublico: ticket.codigoPublico,
            categoriaNombre: ticket.categoria?.nombre || 'General',
            conciertoTitulo: ticket.concierto?.titulo || '',
            fechaEmision: ticket.fechaEmision.toISOString(),
          },
        };
      }

      // Comprobar estado del ticket
      if (ticket.estado === TicketEstado.UTILIZADO) {
        await queryRunner.manager.save(
          TicketValidacion,
          queryRunner.manager.create(TicketValidacion, {
            ticketId: ticket.id,
            conciertoId: dto.conciertoId,
            verificadorId: verificadorUserId,
            resultado: ValidacionResultado.YA_UTILIZADO,
            motivo: 'Entrada previamente validada.',
          }),
        );
        await queryRunner.commitTransaction();

        return {
          valido: false,
          resultado: ValidacionResultado.YA_UTILIZADO,
          mensaje: `¡ENTRADA YA UTILIZADA! Ingreso registrado el ${new Date(
            ticket.fechaUtilizado!,
          ).toLocaleDateString('es-BO', {
            hour: '2-digit',
            minute: '2-digit',
            day: 'numeric',
            month: 'short',
          })}.`,
          ticket: {
            codigoPublico: ticket.codigoPublico,
            categoriaNombre: ticket.categoria?.nombre || '',
            conciertoTitulo: ticket.concierto?.titulo || '',
            fechaEmision: ticket.fechaEmision.toISOString(),
            fechaUtilizado: ticket.fechaUtilizado?.toISOString(),
          },
        };
      }

      if (
        ticket.concierto?.estado === ConciertoEstado.CANCELADO ||
        ticket.estado === TicketEstado.INVALIDADO
      ) {
        const esConciertoCancelado =
          ticket.concierto?.estado === ConciertoEstado.CANCELADO;
        await queryRunner.manager.save(
          TicketValidacion,
          queryRunner.manager.create(TicketValidacion, {
            ticketId: ticket.id,
            conciertoId: dto.conciertoId,
            verificadorId: verificadorUserId,
            resultado: ValidacionResultado.INVALIDADO,
            motivo: esConciertoCancelado
              ? 'Concierto cancelado por el organizador.'
              : ticket.motivoInvalidacion || 'Entrada invalidada o cancelada.',
          }),
        );
        await queryRunner.commitTransaction();

        return {
          valido: false,
          resultado: ValidacionResultado.INVALIDADO,
          mensaje: esConciertoCancelado
            ? 'El concierto ha sido cancelado por el organizador. Esta entrada no autoriza el ingreso.'
            : 'Esta entrada ha sido invalidada y no puede ser utilizada.',
          ticket: {
            codigoPublico: ticket.codigoPublico,
            categoriaNombre: ticket.categoria?.nombre || '',
            conciertoTitulo: ticket.concierto?.titulo || '',
            fechaEmision: ticket.fechaEmision.toISOString(),
          },
        };
      }

      // Ticket VIGENTE -> Validar y marcar como UTILIZADO atómicamente
      ticket.estado = TicketEstado.UTILIZADO;
      ticket.fechaUtilizado = new Date();
      await queryRunner.manager.save(Ticket, ticket);

      await queryRunner.manager.save(
        TicketValidacion,
        queryRunner.manager.create(TicketValidacion, {
          ticketId: ticket.id,
          conciertoId: dto.conciertoId,
          verificadorId: verificadorUserId,
          resultado: ValidacionResultado.EXITOSO,
          motivo: 'Ingreso autorizado.',
        }),
      );

      await queryRunner.commitTransaction();

      return {
        valido: true,
        resultado: ValidacionResultado.EXITOSO,
        mensaje: '¡INGRESO AUTORIZADO!',
        ticket: {
          codigoPublico: ticket.codigoPublico,
          categoriaNombre: ticket.categoria?.nombre || 'General',
          conciertoTitulo: ticket.concierto?.titulo || '',
          fechaEmision: ticket.fechaEmision.toISOString(),
          fechaUtilizado: ticket.fechaUtilizado.toISOString(),
        },
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // 7. Conciertos asignados a un verificador
  async listarConciertosAsignadosVerificador(verificadorUserId: string) {
    const asignaciones = await this.verificadoresRepo.find({
      where: { usuarioId: verificadorUserId, activo: true },
      relations: {
        concierto: true,
      },
    });

    const conciertos = asignaciones
      .map((a) => a.concierto)
      .filter((c) => c && c.estado === ConciertoEstado.PUBLICADO);

    return Promise.all(
      conciertos.map(async (c) => {
        const totalTicketsEmitidos = await this.ticketsRepo.count({
          where: { conciertoId: c.id },
        });
        const totalTicketsValidados = await this.ticketsRepo.count({
          where: { conciertoId: c.id, estado: TicketEstado.UTILIZADO },
        });

        return {
          conciertoId: c.id,
          titulo: c.titulo,
          recinto: c.recinto,
          ciudad: c.ciudad,
          fechaInicio: c.fechaInicio.toISOString(),
          portadaUrl: c.portadaUrl,
          totalTicketsEmitidos,
          totalTicketsValidados,
        };
      }),
    );
  }

  // 8. Gestión de verificadores por el Organizador
  async asignarVerificador(
    organizadorUserId: string,
    conciertoId: string,
    dto: AssignVerifierDto,
  ) {
    const concierto = await this.conciertosRepo.findOne({
      where: { id: conciertoId },
    });
    if (!concierto) throw new NotFoundException('Concierto no encontrado.');
    if (concierto.organizadorId !== organizadorUserId) {
      throw new ForbiddenException('No tienes permiso para gestionar este concierto.');
    }

    const usuarioVerificador = await this.usuariosRepo.findOne({
      where: { id: dto.usuarioId },
      relations: { roles: true },
    });
    if (!usuarioVerificador) throw new NotFoundException('Usuario no encontrado.');

    const tieneRolVerificador = usuarioVerificador.roles?.some(
      (r) => r.nombre === RolNombre.VERIFICADOR || r.nombre === RolNombre.ADMIN,
    );
    if (!tieneRolVerificador) {
      throw new BadRequestException(
        'El usuario seleccionado no cuenta con el rol VERIFICADOR.',
      );
    }

    let asignacion = await this.verificadoresRepo.findOne({
      where: { conciertoId, usuarioId: dto.usuarioId },
    });

    if (asignacion) {
      asignacion.activo = true;
      asignacion.asignadoPor = organizadorUserId;
    } else {
      asignacion = this.verificadoresRepo.create({
        conciertoId,
        usuarioId: dto.usuarioId,
        asignadoPor: organizadorUserId,
        activo: true,
      });
    }

    const saved = await this.verificadoresRepo.save(asignacion);
    return { success: true, asignacionId: saved.id };
  }

  async removerVerificador(
    organizadorUserId: string,
    conciertoId: string,
    verificadorUsuarioId: string,
  ) {
    const concierto = await this.conciertosRepo.findOne({
      where: { id: conciertoId },
    });
    if (!concierto) throw new NotFoundException('Concierto no encontrado.');
    if (concierto.organizadorId !== organizadorUserId) {
      throw new ForbiddenException('No tienes permiso para gestionar este concierto.');
    }

    await this.verificadoresRepo.delete({
      conciertoId,
      usuarioId: verificadorUsuarioId,
    });
    return { success: true };
  }

  async listarVerificadoresConcierto(
    organizadorUserId: string,
    conciertoId: string,
  ) {
    const concierto = await this.conciertosRepo.findOne({
      where: { id: conciertoId },
    });
    if (!concierto) throw new NotFoundException('Concierto no encontrado.');
    if (concierto.organizadorId !== organizadorUserId) {
      throw new ForbiddenException('No tienes permiso para consultar este concierto.');
    }

    const list = await this.verificadoresRepo.find({
      where: { conciertoId, activo: true },
      relations: { usuario: true },
    });

    return list.map((a) => ({
      id: a.id,
      usuarioId: a.usuarioId,
      username: a.usuario.username,
      email: a.usuario.email,
      displayName: a.usuario.displayName,
      activo: a.activo,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async listarCuentasVerificadoresDisponibles() {
    const usuarios = await this.usuariosRepo
      .createQueryBuilder('u')
      .innerJoin('u.roles', 'r')
      .where('r.nombre = :rol', { rol: RolNombre.VERIFICADOR })
      .getMany();

    return usuarios.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      displayName: u.displayName,
    }));
  }

  // Helpers
  private mapOrden(o: OrdenCompra) {
    return {
      id: o.id,
      usuarioId: o.usuarioId,
      conciertoId: o.conciertoId,
      conciertoTitulo: o.concierto?.titulo || '',
      conciertoPortadaUrl: o.concierto?.portadaUrl || null,
      estado: o.estado,
      total: Number(o.total),
      moneda: o.moneda,
      expiraEn: o.expiraEn instanceof Date ? o.expiraEn.toISOString() : o.expiraEn,
      operacionId: o.operacionId,
      proveedorPago: o.proveedorPago,
      pagoTransaccionId: o.pagoTransaccionId,
      pagoEstado: o.pagoEstado,
      confirmadaEn: o.confirmadaEn ? o.confirmadaEn.toISOString() : null,
      reembolsoEstado: o.reembolsoEstado || ReembolsoEstado.NINGUNO,
      montoReembolsado: Number(o.montoReembolsado || 0),
      reembolsos: (o.reembolsos || []).map((r) => this.mapReembolso(r)),
      items: (o.items || []).map((it) => ({
        id: it.id,
        categoriaId: it.categoriaId,
        categoriaNombre: it.categoria?.nombre || '',
        cantidad: it.cantidad,
        precioUnitario: Number(it.precioUnitario),
        subtotal: Number(it.subtotal),
      })),
      createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    };
  }

  private async mapTicket(t: Ticket, includeQrDataUrl = false) {
    let qrCodeDataUrl: string | undefined = undefined;
    if (includeQrDataUrl) {
      try {
        qrCodeDataUrl = await qrcode.toDataURL(t.qrToken, {
          errorCorrectionLevel: 'M',
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
        });
      } catch {
        // Fallback
      }
    }

    const esCancelado = t.concierto?.estado === ConciertoEstado.CANCELADO;
    return {
      id: t.id,
      ordenId: t.ordenId,
      conciertoId: t.conciertoId,
      conciertoTitulo: t.concierto?.titulo || '',
      conciertoPortadaUrl: t.concierto?.portadaUrl || null,
      fechaInicio: t.concierto?.fechaInicio ? t.concierto.fechaInicio.toISOString() : '',
      recinto: t.concierto?.recinto || '',
      ciudad: t.concierto?.ciudad || '',
      categoriaId: t.categoriaId,
      categoriaNombre: t.categoria?.nombre || 'General',
      precio: Number(t.categoria?.precio || 0),
      moneda: t.categoria?.moneda || 'BOB',
      estado: esCancelado ? TicketEstado.INVALIDADO : t.estado,
      codigoPublico: t.codigoPublico,
      qrToken: t.qrToken,
      qrCodeDataUrl,
      fechaEmision: t.fechaEmision instanceof Date ? t.fechaEmision.toISOString() : t.fechaEmision,
      fechaUtilizado: t.fechaUtilizado ? t.fechaUtilizado.toISOString() : null,
      motivoInvalidacion: t.motivoInvalidacion || (esCancelado ? 'CONCIERTO_CANCELADO' : null),
      conciertoCancelado: esCancelado,
      motivoCancelacion: esCancelado ? (t.concierto?.motivoCancelacion || 'Concierto cancelado por el organizador') : null,
      reembolsoEstado: t.orden?.reembolsoEstado || (esCancelado ? ReembolsoEstado.PENDIENTE_REEMBOLSO : ReembolsoEstado.NINGUNO),
    };
  }

  private async obtenerTicketsConQr(ordenId: string) {
    const tickets = await this.ticketsRepo.find({
      where: { ordenId },
      relations: { concierto: true, categoria: true },
    });
    return Promise.all(tickets.map((t) => this.mapTicket(t, true)));
  }

  // ==========================================
  // REEMBOLSOS Y SIMULADOR SANDBOX
  // ==========================================

  mapReembolso(r: Reembolso) {
    return {
      id: r.id,
      ordenId: r.ordenId,
      conciertoId: r.conciertoId,
      reembolsoTransaccionId: r.reembolsoTransaccionId,
      monto: Number(r.monto),
      moneda: r.moneda,
      tipo: r.tipo,
      estado: r.estado,
      motivo: r.motivo,
      procesadoEn: r.procesadoEn ? r.procesadoEn.toISOString() : null,
      mensajeResultado: r.mensajeResultado || null,
      idempotencyKey: r.idempotencyKey || null,
      createdAt:
        r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
    };
  }

  // Solicitar devolución (total o parcial)
  async solicitarReembolso(
    userId: string,
    dto: SolicitarReembolsoDto,
    roles: string[] = [],
  ) {
    const orden = await this.ordenesRepo.findOne({
      where: { id: dto.ordenId },
      relations: { concierto: true, reembolsos: true },
    });

    if (!orden) {
      throw new NotFoundException('Orden de compra no encontrada.');
    }

    const isOwner = orden.usuarioId === userId;
    const isOrganizer = orden.concierto?.organizadorId === userId;
    const isAdmin = roles.includes(RolNombre.ADMIN);

    if (!isOwner && !isOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para solicitar la devolución de esta orden.',
      );
    }

    if (
      orden.estado !== OrdenEstado.CONFIRMADA &&
      orden.estado !== OrdenEstado.CANCELADA
    ) {
      throw new BadRequestException(
        'Solo se puede solicitar devolución para órdenes pagadas o afectadas por cancelación.',
      );
    }

    // Idempotencia
    if (dto.idempotencyKey) {
      const existente = await this.reembolsosRepo.findOne({
        where: { idempotencyKey: dto.idempotencyKey },
      });
      if (existente) {
        return this.mapReembolso(existente);
      }
    }

    const totalOrden = Number(orden.total);
    const yaReembolsado = Number(orden.montoReembolsado || 0);
    const montoDisponible = Math.max(0, totalOrden - yaReembolsado);

    if (montoDisponible <= 0) {
      throw new BadRequestException(
        'Esta orden ya ha sido reembolsada en su totalidad.',
      );
    }

    const montoSolicitado =
      dto.monto !== undefined ? Number(dto.monto) : montoDisponible;

    if (montoSolicitado <= 0) {
      throw new BadRequestException(
        'El importe de devolución debe ser mayor a 0.',
      );
    }

    if (montoSolicitado > montoDisponible + 0.001) {
      throw new BadRequestException(
        `El importe de devolución (${montoSolicitado} BOB) supera el importe disponible a devolver (${montoDisponible} BOB).`,
      );
    }

    const tipo: ReembolsoTipo =
      (dto.tipo as ReembolsoTipo) ||
      (montoSolicitado >= totalOrden - 0.001
        ? ReembolsoTipo.TOTAL
        : ReembolsoTipo.PARCIAL);

    const transaccionId = `SANDBOX-REF-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;

    const solicitud = this.reembolsosRepo.create({
      ordenId: orden.id,
      conciertoId: orden.conciertoId,
      reembolsoTransaccionId: transaccionId,
      monto: montoSolicitado,
      moneda: orden.moneda || 'BOB',
      tipo,
      estado: ReembolsoEstadoOperacion.PENDIENTE,
      motivo: dto.motivo.trim(),
      solicitadoPorId: userId,
      idempotencyKey: dto.idempotencyKey || null,
    });

    const guardado = (await this.reembolsosRepo.save(solicitud)) as Reembolso;

    orden.reembolsoEstado = ReembolsoEstado.PENDIENTE_REEMBOLSO;
    await this.ordenesRepo.save(orden);

    return this.mapReembolso(guardado);
  }

  // Procesar solicitud de devolución en el Sandbox de pruebas
  async procesarReembolso(
    reembolsoId: string,
    accion: 'COMPLETAR' | 'FALLAR',
    mensaje?: string,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const reembolso = await queryRunner.manager
        .createQueryBuilder(Reembolso, 'r')
        .setLock('pessimistic_write')
        .where('r.id = :id', { id: reembolsoId })
        .getOne();

      if (!reembolso) {
        throw new NotFoundException('Solicitud de devolución no encontrada.');
      }

      // Idempotencia: si ya fue completado, no procesar dos veces
      if (reembolso.estado === ReembolsoEstadoOperacion.COMPLETADO) {
        await queryRunner.commitTransaction();
        return this.mapReembolso(reembolso);
      }

      const orden = await queryRunner.manager
        .createQueryBuilder(OrdenCompra, 'o')
        .setLock('pessimistic_write')
        .where('o.id = :id', { id: reembolso.ordenId })
        .getOne();

      if (!orden) {
        throw new NotFoundException('Orden asociada no encontrada.');
      }

      if (accion === 'COMPLETAR') {
        const totalOrden = Number(orden.total);
        const yaReembolsado = Number(orden.montoReembolsado || 0);
        const montoReembolso = Number(reembolso.monto);

        if (yaReembolsado + montoReembolso > totalOrden + 0.001) {
          throw new BadRequestException(
            'El importe total acumulado de devolución superaría el total de la orden.',
          );
        }

        reembolso.estado = ReembolsoEstadoOperacion.COMPLETADO;
        reembolso.procesadoEn = new Date();
        reembolso.mensajeResultado =
          mensaje || 'Devolución procesada y completada en entorno Sandbox.';
        await queryRunner.manager.save(Reembolso, reembolso);

        orden.montoReembolsado = yaReembolsado + montoReembolso;
        if (orden.montoReembolsado >= totalOrden - 0.001) {
          orden.reembolsoEstado = ReembolsoEstado.REEMBOLSADO;
        } else {
          orden.reembolsoEstado = ReembolsoEstado.REEMBOLSO_PARCIAL;
        }
        await queryRunner.manager.save(OrdenCompra, orden);
      } else {
        reembolso.estado = ReembolsoEstadoOperacion.FALLIDO;
        reembolso.procesadoEn = new Date();
        reembolso.mensajeResultado =
          mensaje || 'Devolución rechazada o fallida en simulación.';
        await queryRunner.manager.save(Reembolso, reembolso);

        // Verificar si quedan otros reembolsos pendientes
        const pendientesRestantes = await queryRunner.manager.count(Reembolso, {
          where: {
            ordenId: orden.id,
            estado: ReembolsoEstadoOperacion.PENDIENTE,
          },
        });

        if (pendientesRestantes === 0) {
          if (Number(orden.montoReembolsado || 0) > 0) {
            orden.reembolsoEstado = ReembolsoEstado.REEMBOLSO_PARCIAL;
          } else {
            orden.reembolsoEstado = ReembolsoEstado.NINGUNO;
          }
          await queryRunner.manager.save(OrdenCompra, orden);
        }
      }

      await queryRunner.commitTransaction();
      return this.mapReembolso(reembolso);
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  // Reintentar una devolución fallida
  async reintentarReembolso(
    reembolsoId: string,
    userId: string,
    roles: string[] = [],
  ) {
    const reembolso = await this.reembolsosRepo.findOne({
      where: { id: reembolsoId },
      relations: { orden: { concierto: true } },
    });

    if (!reembolso) {
      throw new NotFoundException('Solicitud de devolución no encontrada.');
    }

    const isOwner = reembolso.orden?.usuarioId === userId;
    const isOrganizer = reembolso.orden?.concierto?.organizadorId === userId;
    const isAdmin = roles.includes(RolNombre.ADMIN);

    if (!isOwner && !isOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para reintentar esta devolución.',
      );
    }

    if (reembolso.estado !== ReembolsoEstadoOperacion.FALLIDO) {
      throw new BadRequestException(
        'Solo se pueden reintentar devoluciones que se encuentren en estado FALLIDO.',
      );
    }

    reembolso.estado = ReembolsoEstadoOperacion.PENDIENTE;
    reembolso.procesadoEn = null;
    reembolso.mensajeResultado = null;
    await this.reembolsosRepo.save(reembolso);

    if (reembolso.orden) {
      reembolso.orden.reembolsoEstado = ReembolsoEstado.PENDIENTE_REEMBOLSO;
      await this.ordenesRepo.save(reembolso.orden);
    }

    return this.mapReembolso(reembolso);
  }

  // Consultar devoluciones de una orden
  async obtenerReembolsosOrden(
    userId: string,
    ordenId: string,
    roles: string[] = [],
  ) {
    const orden = await this.ordenesRepo.findOne({
      where: { id: ordenId },
      relations: { concierto: true },
    });

    if (!orden) {
      throw new NotFoundException('Orden no encontrada.');
    }

    const isOwner = orden.usuarioId === userId;
    const isOrganizer = orden.concierto?.organizadorId === userId;
    const isAdmin = roles.includes(RolNombre.ADMIN);

    if (!isOwner && !isOrganizer && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para consultar las devoluciones de esta orden.',
      );
    }

    const reembolsos = await this.reembolsosRepo.find({
      where: { ordenId },
      order: { createdAt: 'DESC' },
    });

    return reembolsos.map((r) => this.mapReembolso(r));
  }

  // Consultar todas las devoluciones de un concierto para el organizador
  async obtenerReembolsosOrganizador(
    userId: string,
    conciertoId: string,
    roles: string[] = [],
  ) {
    const concierto = await this.conciertosRepo.findOne({
      where: { id: conciertoId },
    });

    if (!concierto) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    const isOwner = concierto.organizadorId === userId;
    const isAdmin = roles.includes(RolNombre.ADMIN);

    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para consultar las devoluciones de este concierto.',
      );
    }

    const reembolsos = await this.reembolsosRepo.find({
      where: { conciertoId },
      order: { createdAt: 'DESC' },
    });

    let pendientes = 0;
    let completados = 0;
    let fallidos = 0;
    let montoPendienteBob = 0;
    let montoCompletadoBob = 0;
    let montoFallidoBob = 0;

    for (const r of reembolsos) {
      const monto = Number(r.monto);
      if (
        r.estado === ReembolsoEstadoOperacion.PENDIENTE ||
        r.estado === ReembolsoEstadoOperacion.EN_PROCESO
      ) {
        pendientes++;
        montoPendienteBob += monto;
      } else if (r.estado === ReembolsoEstadoOperacion.COMPLETADO) {
        completados++;
        montoCompletadoBob += monto;
      } else if (r.estado === ReembolsoEstadoOperacion.FALLIDO) {
        fallidos++;
        montoFallidoBob += monto;
      }
    }

    return {
      conciertoId,
      totalSolicitudes: reembolsos.length,
      pendientes,
      completados,
      fallidos,
      montoPendienteBob: Number(montoPendienteBob.toFixed(2)),
      montoCompletadoBob: Number(montoCompletadoBob.toFixed(2)),
      montoFallidoBob: Number(montoFallidoBob.toFixed(2)),
      reembolsos: reembolsos.map((r) => this.mapReembolso(r)),
    };
  }

  // Procesar webhook proveniente del simulador Sandbox
  async procesarWebhookSandbox(rawPayload: string, signature: string) {
    if (!signature) {
      throw new UnauthorizedException('Firma de webhook ausente.');
    }

    const valida = this.sandboxGatewayService.verifySignature(
      rawPayload,
      signature,
    );
    if (!valida) {
      throw new UnauthorizedException('Firma de webhook inválida.');
    }

    let parsed: any;
    try {
      parsed = typeof rawPayload === 'string' ? JSON.parse(rawPayload) : rawPayload;
    } catch {
      throw new BadRequestException('Carga de webhook no es JSON válido.');
    }

    const event = parsed.event;
    const data = parsed.data || {};

    if (event === 'payment.succeeded') {
      const orden = await this.ordenesRepo.findOne({
        where: { id: data.orderId },
        relations: {
          items: { categoria: true },
          concierto: true,
          tickets: true,
        },
      });

      if (!orden) {
        return { received: true, status: 'ORDER_NOT_FOUND' };
      }

      // Idempotencia: si ya está confirmada, no emitir tickets duplicados
      if (orden.estado === OrdenEstado.CONFIRMADA) {
        return { received: true, status: 'ALREADY_CONFIRMED' };
      }

      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const conciertoLock = await queryRunner.manager
          .createQueryBuilder(Concierto, 'c')
          .setLock('pessimistic_write')
          .where('c.id = :conciertoId', { conciertoId: orden.conciertoId })
          .getOne();

        if (!conciertoLock || conciertoLock.estado === ConciertoEstado.CANCELADO) {
          orden.estado = OrdenEstado.CANCELADA;
          orden.reembolsoEstado = ReembolsoEstado.PENDIENTE_REEMBOLSO;
          orden.proveedorPago = 'SANDBOX_WEBHOOK';
          orden.pagoTransaccionId = data.transactionId;
          orden.pagoEstado = 'APROBADO_POST_CANCELACION';
          await queryRunner.manager.save(OrdenCompra, orden);

          // Crear solicitud de reembolso pendiente por carrera con cancelación
          const solicitud = queryRunner.manager.create(Reembolso, {
            ordenId: orden.id,
            conciertoId: orden.conciertoId,
            reembolsoTransaccionId: `SANDBOX-REF-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
            monto: Number(orden.total),
            moneda: orden.moneda || 'BOB',
            tipo: ReembolsoTipo.TOTAL,
            estado: ReembolsoEstadoOperacion.PENDIENTE,
            motivo: 'Cancelación concurrente de concierto durante pago',
            solicitadoPorId: orden.usuarioId,
          });
          await queryRunner.manager.save(Reembolso, solicitud);

          await queryRunner.commitTransaction();
          return { received: true, status: 'CONCERT_CANCELLED' };
        }

        orden.estado = OrdenEstado.CONFIRMADA;
        orden.proveedorPago = 'SANDBOX_WEBHOOK';
        orden.pagoTransaccionId = data.transactionId;
        orden.pagoEstado = 'APROBADO';
        orden.confirmadaEn = new Date();
        await queryRunner.manager.save(OrdenCompra, orden);

        // Confirmar reservas
        await queryRunner.manager
          .createQueryBuilder(ReservaCupo, 'r')
          .update()
          .set({ confirmada: true })
          .where('orden_id = :ordenId', { ordenId: orden.id })
          .execute();

        // Emitir tickets
        for (const it of orden.items || []) {
          for (let i = 0; i < it.cantidad; i++) {
            const codigoPublico = `SL-TK-${randomBytes(4).toString('hex').toUpperCase()}`;
            const qrToken = `SLQR_${randomBytes(32).toString('hex')}`;

            const ticket = queryRunner.manager.create(Ticket, {
              ordenId: orden.id,
              conciertoId: orden.conciertoId,
              categoriaId: it.categoriaId,
              usuarioId: orden.usuarioId,
              estado: TicketEstado.VIGENTE,
              codigoPublico,
              qrToken,
              fechaEmision: new Date(),
            });
            await queryRunner.manager.save(Ticket, ticket);
          }
        }

        await queryRunner.commitTransaction();
        return { received: true, status: 'ORDER_CONFIRMED' };
      } catch (e) {
        await queryRunner.rollbackTransaction();
        throw e;
      } finally {
        await queryRunner.release();
      }
    } else if (event === 'payment.failed') {
      const orden = await this.ordenesRepo.findOne({
        where: { id: data.orderId },
        relations: { items: true },
      });

      if (!orden || orden.estado === OrdenEstado.CONFIRMADA) {
        return { received: true, status: 'IGNORED_OR_CONFIRMED' };
      }

      orden.estado = OrdenEstado.FALLIDA;
      orden.pagoEstado = 'RECHAZADO';
      await this.ordenesRepo.save(orden);

      // Liberar cupos
      for (const it of orden.items || []) {
        await this.dataSource
          .createQueryBuilder()
          .update(ConciertoCategoria)
          .set({
            cupoDisponible: () => `cupo_disponible + ${it.cantidad}`,
          })
          .where('id = :catId', { catId: it.categoriaId })
          .execute();
      }

      return { received: true, status: 'ORDER_FAILED' };
    } else if (event === 'refund.succeeded') {
      const refund = await this.reembolsosRepo.findOne({
        where: [
          { id: data.refundId || '' },
          { reembolsoTransaccionId: data.transactionId || '' },
          { ordenId: data.orderId || '' },
        ],
      });

      if (!refund) {
        return { received: true, status: 'REFUND_NOT_FOUND' };
      }

      await this.procesarReembolso(
        refund.id,
        'COMPLETAR',
        data.reason || 'Devolución confirmada por webhook Sandbox.',
      );
      return { received: true, status: 'REFUND_COMPLETED' };
    } else if (event === 'refund.failed') {
      const refund = await this.reembolsosRepo.findOne({
        where: [
          { id: data.refundId || '' },
          { reembolsoTransaccionId: data.transactionId || '' },
          { ordenId: data.orderId || '' },
        ],
      });

      if (!refund) {
        return { received: true, status: 'REFUND_NOT_FOUND' };
      }

      await this.procesarReembolso(
        refund.id,
        'FALLAR',
        data.reason || 'Devolución rechazada por webhook Sandbox.',
      );
      return { received: true, status: 'REFUND_FAILED' };
    }

    return { received: true, event };
  }
}
