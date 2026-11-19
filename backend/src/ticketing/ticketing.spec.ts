import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { TicketingService } from './ticketing.service.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import {
  OrdenCompra,
  OrdenEstado,
} from './orden-compra.entity.js';
import {
  Ticket,
  TicketEstado,
} from './ticket.entity.js';
import {
  ValidacionResultado,
} from './ticket-validacion.entity.js';
import {
  Concierto,
  ConciertoEstado,
} from '../conciertos/concierto.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { RolNombre } from '../auth/rol.entity.js';

describe('CU20, CU21, CU22 — Ticketing, Emisión QR y Validación de Ingreso', () => {
  let service: TicketingService;
  let paymentProvider: MockPaymentProvider;

  let mockDataSource: any;
  let mockOrdenesRepo: any;
  let mockOrdenItemsRepo: any;
  let mockReservasRepo: any;
  let mockTicketsRepo: any;
  let mockVerificadoresRepo: any;
  let mockValidacionesRepo: any;
  let mockConciertosRepo: any;
  let mockCategoriasRepo: any;
  let mockUsuariosRepo: any;

  const buyerUserId1 = 'u0000000-0000-4000-8000-000000000001';
  const buyerUserId2 = 'u0000000-0000-4000-8000-000000000002';
  const verifierUserId1 = 'v0000000-0000-4000-8000-000000000001';
  const verifierUserId2 = 'v0000000-0000-4000-8000-000000000002';
  const orgUserId = 'o0000000-0000-4000-8000-000000000001';

  const concertId = 'c0000000-0000-4000-8000-000000000001';
  const categoriaId = 'cat00000-0000-4000-8000-000000000001';
  const categoryId = categoriaId;
  const orderId = 'ord00000-0000-4000-8000-000000000001';
  const ordenId = orderId;
  const ticketId = 'tkt00000-0000-4000-8000-000000000001';
  const validQrToken = 'SLQR_1234567890abcdef1234567890abcdef1234567890abcdef';

  let mockConcert: Concierto;
  let mockCategory: ConciertoCategoria;
  let mockOrder: OrdenCompra;
  let mockTicket: Ticket;

  beforeEach(() => {
    paymentProvider = new MockPaymentProvider();

    mockConcert = {
      id: concertId,
      organizadorId: orgUserId,
      titulo: 'Illimani Metal Fest 2026',
      descripcion: 'Festival en La Paz',
      portadaUrl: '/covers/fest.jpg',
      genero: 'Metal',
      fechaInicio: new Date(Date.now() + 86400000 * 20),
      fechaFin: new Date(Date.now() + 86400000 * 20 + 3600000 * 6),
      zonaHoraria: 'America/La_Paz',
      recinto: 'Teatro al Aire Libre',
      direccion: 'Av. del Poeta',
      ciudad: 'La Paz',
      departamento: 'La Paz',
      estado: ConciertoEstado.PUBLICADO,
      inicioVenta: new Date(Date.now() - 3600000), // Venta ya iniciada
      destacado: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    mockCategory = {
      id: categoryId,
      conciertoId: concertId,
      nombre: 'VIP',
      precio: 150,
      moneda: 'BOB',
      cupoTotal: 10,
      cupoDisponible: 10,
      disponible: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    mockOrder = {
      id: orderId,
      usuarioId: buyerUserId1,
      conciertoId: concertId,
      estado: OrdenEstado.PENDIENTE,
      total: 300,
      moneda: 'BOB',
      expiraEn: new Date(Date.now() + 15 * 60 * 1000),
      operacionId: 'OP-TEST-001',
      proveedorPago: 'MOCK',
      pagoTransaccionId: null,
      pagoEstado: null,
      confirmadaEn: null,
      items: [
        {
          id: 'item-1',
          ordenId: orderId,
          categoriaId,
          categoria: mockCategory,
          cantidad: 2,
          precioUnitario: 150,
          subtotal: 300,
          createdAt: new Date(),
        } as any,
      ],
      concierto: mockConcert,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    mockTicket = {
      id: ticketId,
      ordenId: orderId,
      conciertoId: concertId,
      categoriaId,
      usuarioId: buyerUserId1,
      estado: TicketEstado.VIGENTE,
      codigoPublico: 'SL-TK-TEST01',
      qrToken: validQrToken,
      fechaEmision: new Date(),
      fechaUtilizado: null,
      concierto: mockConcert,
      categoria: mockCategory,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any;

    // Repositorios Mock
    mockConciertosRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === concertId) return { ...mockConcert };
        return null;
      }),
      count: vi.fn(async () => 1),
    };

    mockCategoriasRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === categoryId) return { ...mockCategory };
        return null;
      }),
      save: vi.fn(async (cat: any) => cat),
    };

    mockOrdenesRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === orderId) return mockOrder;
        if (where.operacionId === mockOrder.operacionId) return mockOrder;
        return null;
      }),
      save: vi.fn(async (ord: any) => {
        Object.assign(mockOrder, ord);
        return ord;
      }),
      create: vi.fn((data: any) => ({ ...data, id: orderId })),
    };

    mockOrdenItemsRepo = {
      save: vi.fn(async (it: any) => it),
      create: vi.fn((data: any) => ({ ...data, id: 'item-1' })),
    };

    mockReservasRepo = {
      save: vi.fn(async (res: any) => res),
      create: vi.fn((data: any) => ({ ...data, id: 'res-1' })),
      createQueryBuilder: vi.fn(() => ({
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getMany: vi.fn(async () => []),
      })),
    };

    mockTicketsRepo = {
      find: vi.fn(async ({ where }: any) => {
        if (where.usuarioId === buyerUserId1 || where.ordenId === orderId) {
          return [{ ...mockTicket }];
        }
        return [];
      }),
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === ticketId) return { ...mockTicket };
        if (where.qrToken === validQrToken) return { ...mockTicket };
        return null;
      }),
      count: vi.fn(async () => 1),
      save: vi.fn(async (t: any) => t),
      create: vi.fn((data: any) => ({ ...data, id: ticketId })),
    };

    mockVerificadoresRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where.conciertoId === concertId && where.usuarioId === verifierUserId1) {
          return {
            id: 'ver-rel-1',
            conciertoId: concertId,
            usuarioId: verifierUserId1,
            activo: true,
          };
        }
        return null;
      }),
      find: vi.fn(async () => [
        {
          id: 'ver-rel-1',
          conciertoId: concertId,
          usuarioId: verifierUserId1,
          activo: true,
          concierto: mockConcert,
          usuario: {
            username: 'verificador1',
            email: 'v1@example.com',
            displayName: 'Verificador Uno',
          },
        },
      ]),
      save: vi.fn(async (a: any) => a),
      create: vi.fn((d: any) => ({ ...d, id: 'ver-rel-1' })),
      delete: vi.fn(async () => ({ affected: 1 })),
    };

    mockValidacionesRepo = {
      save: vi.fn(async (v: any) => v),
      create: vi.fn((data: any) => ({ ...data, id: 'val-1' })),
    };

    mockUsuariosRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === verifierUserId1) {
          return {
            id: verifierUserId1,
            roles: [{ nombre: RolNombre.VERIFICADOR }],
          };
        }
        if (where.id === verifierUserId2) {
          return {
            id: verifierUserId2,
            roles: [{ nombre: RolNombre.VERIFICADOR }],
          };
        }
        return null;
      }),
    };

    // Mock DataSource y QueryRunner para simular transacciones con aislamiento y bloqueo
    const mockQueryRunner = {
      connect: vi.fn(async () => {}),
      startTransaction: vi.fn(async () => {}),
      commitTransaction: vi.fn(async () => {}),
      rollbackTransaction: vi.fn(async () => {}),
      release: vi.fn(async () => {}),
      manager: {
        createQueryBuilder: vi.fn((entity: any, alias: string) => {
          if (alias === 'cat') {
            return {
              setLock: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              update: vi.fn().mockReturnThis(),
              set: vi.fn().mockReturnThis(),
              execute: vi.fn(async () => ({ affected: 1 })),
              getOne: vi.fn(async () => ({ ...mockCategory })),
            };
          }
          if (alias === 'c') {
            return {
              setLock: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              getOne: vi.fn(async () => mockConcert),
            };
          }
          if (alias === 't') {
            return {
              setLock: vi.fn().mockReturnThis(),
              innerJoinAndSelect: vi.fn().mockReturnThis(),
              leftJoinAndSelect: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              getOne: vi.fn(async () => mockTicket),
            };
          }
          if (alias === 'r') {
            return {
              update: vi.fn().mockReturnThis(),
              set: vi.fn().mockReturnThis(),
              where: vi.fn().mockReturnThis(),
              execute: vi.fn(async () => ({ affected: 1 })),
            };
          }
          return {
            where: vi.fn().mockReturnThis(),
            getOne: vi.fn(async () => null),
          };
        }),
        save: vi.fn(async (_entityClass: any, entity: any) => {
          if (entity && entity.id === orderId) {
            Object.assign(mockOrder, entity);
          }
          return entity;
        }),
        create: vi.fn((_entityClass: any, data: any) => ({
          ...data,
          id: data.id || 'gen-uuid',
        })),
      },
    };

    mockDataSource = {
      createQueryRunner: vi.fn(() => mockQueryRunner),
    };

    service = new TicketingService(
      mockDataSource,
      mockOrdenesRepo,
      mockOrdenItemsRepo,
      mockReservasRepo,
      mockTicketsRepo,
      mockVerificadoresRepo,
      mockValidacionesRepo,
      mockConciertosRepo,
      mockCategoriasRepo,
      mockUsuariosRepo,
      paymentProvider,
    );
  });

  describe('CU20 — Comprar entradas', () => {
    it('crea una reserva y orden de compra válida para un concierto publicado', async () => {
      const order = await service.crearReservaOrden(buyerUserId1, {
        conciertoId: concertId,
        categoriaId,
        cantidad: 2,
      });

      expect(order).toBeDefined();
      expect(order.estado).toBe(OrdenEstado.PENDIENTE);
      expect(order.total).toBe(300);
      expect(order.moneda).toBe('BOB');
      expect(order.items[0].cantidad).toBe(2);
    });

    it('rechaza comprar entradas si el concierto está en BORRADOR', async () => {
      mockConcert.estado = ConciertoEstado.BORRADOR;

      await expect(
        service.crearReservaOrden(buyerUserId1, {
          conciertoId: concertId,
          categoriaId,
          cantidad: 1,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza comprar entradas antes del inicio programado de venta', async () => {
      mockConcert.inicioVenta = new Date(Date.now() + 86400000 * 2); // En el futuro

      await expect(
        service.crearReservaOrden(buyerUserId1, {
          conciertoId: concertId,
          categoriaId,
          cantidad: 1,
        }),
      ).rejects.toThrow(/aún no ha iniciado/i);
    });

    it('rechaza comprar entradas si el concierto ya finalizó', async () => {
      mockConcert.fechaFin = new Date(Date.now() - 3600000); // En el pasado

      await expect(
        service.crearReservaOrden(buyerUserId1, {
          conciertoId: concertId,
          categoriaId,
          cantidad: 1,
        }),
      ).rejects.toThrow(/ha finalizado/i);
    });

    it('rechaza compras que excedan el cupo disponible', async () => {
      const qr: any = mockDataSource.createQueryRunner();
      qr.manager.createQueryBuilder = vi.fn(() => ({
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn(async () => ({
          ...mockCategory,
          cupoDisponible: 1, // Solo queda 1 cupo
        })),
      }));

      await expect(
        service.crearReservaOrden(buyerUserId1, {
          conciertoId: concertId,
          categoriaId,
          cantidad: 2, // Intenta comprar 2
        }),
      ).rejects.toThrow(/No hay suficientes cupos disponibles/i);
    });

    it('concurrencia: si dos compradores intentan adquirir el último cupo, solo uno lo obtiene', async () => {
      let cupoRestante = 1;

      const qr: any = mockDataSource.createQueryRunner();
      qr.manager.createQueryBuilder = vi.fn(() => ({
        setLock: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn(async () => {
          if (cupoRestante <= 0) {
            return { ...mockCategory, cupoDisponible: 0 };
          }
          cupoRestante--;
          return { ...mockCategory, cupoDisponible: 1 };
        }),
      }));

      // Primer comprador solicita 1 cupo
      const compra1 = await service.crearReservaOrden(buyerUserId1, {
        conciertoId: concertId,
        categoriaId,
        cantidad: 1,
      });
      expect(compra1).toBeDefined();

      // Segundo comprador intenta adquirir el mismo último cupo
      await expect(
        service.crearReservaOrden(buyerUserId2, {
          conciertoId: concertId,
          categoriaId,
          cantidad: 1,
        }),
      ).rejects.toThrow(/No hay suficientes cupos disponibles/i);
    });

    it('procesa pago de prueba aprobado y emite exactamente un ticket por cada entrada', async () => {
      const result = await service.procesarPago(buyerUserId1, {
        ordenId,
        simularResultado: 'APROBADO',
      });

      expect(result.orden.estado).toBe(OrdenEstado.CONFIRMADA);
      expect(result.tickets.length).toBe(2);
      expect(result.tickets[0].codigoPublico).toMatch(/^SL-TK-/);
      expect(result.tickets[0].qrToken).toMatch(/^SLQR_/);
      expect(result.tickets[0].qrCodeDataUrl).toBeDefined();
    });

    it('rechaza pago de prueba si se solicita simular resultado RECHAZADO y libera la reserva', async () => {
      await expect(
        service.procesarPago(buyerUserId1, {
          ordenId,
          simularResultado: 'RECHAZADO',
        }),
      ).rejects.toThrow(/El pago simulado fue rechazado/i);

      expect(mockOrder.estado).toBe(OrdenEstado.FALLIDA);
    });

    it('idempotencia: reintentar pago de orden confirmada no genera tickets duplicados', async () => {
      mockOrder.estado = OrdenEstado.CONFIRMADA;

      const result = await service.procesarPago(buyerUserId1, {
        ordenId,
        simularResultado: 'APROBADO',
      });

      expect(result.orden.estado).toBe(OrdenEstado.CONFIRMADA);
      expect(result.tickets.length).toBe(1); // Retorna los tickets ya emitidos
      expect(mockDataSource.createQueryRunner().manager.save).not.toHaveBeenCalled();
    });
  });

  describe('CU21 — Consultar entradas y mostrar QR', () => {
    it('permite al usuario consultar sus propios tickets con código QR generado', async () => {
      const tickets = await service.listarMisTickets(buyerUserId1);

      expect(tickets.length).toBe(1);
      expect(tickets[0].codigoPublico).toBe('SL-TK-TEST01');
      expect(tickets[0].qrCodeDataUrl).toContain('data:image/png;base64');
    });

    it('deniega acceso si un usuario intenta consultar el ticket de otra persona', async () => {
      await expect(
        service.obtenerDetalleTicket(buyerUserId2, ticketId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('CU22 — Validar ingreso mediante QR', () => {
    it('valida exitosamente un QR vigente cuando el verificador está asignado al concierto', async () => {
      const res = await service.validarIngresoQR(verifierUserId1, {
        conciertoId: concertId,
        qrToken: validQrToken,
      });

      expect(res.valido).toBe(true);
      expect(res.resultado).toBe(ValidacionResultado.EXITOSO);
      expect(mockTicket.estado).toBe(TicketEstado.UTILIZADO);
      expect(mockTicket.fechaUtilizado).toBeDefined();
    });

    it('rechaza la validación si el verificador NO está asignado a ese concierto', async () => {
      const res = await service.validarIngresoQR(verifierUserId2, {
        conciertoId: concertId,
        qrToken: validQrToken,
      });

      expect(res.valido).toBe(false);
      expect(res.resultado).toBe(ValidacionResultado.NO_AUTORIZADO);
      expect(res.mensaje).toMatch(/No tienes autorización/i);
    });

    it('rechaza la validación de un QR ya utilizado previamente (doble ingreso)', async () => {
      mockTicket.estado = TicketEstado.UTILIZADO;
      mockTicket.fechaUtilizado = new Date(Date.now() - 3600000);

      const res = await service.validarIngresoQR(verifierUserId1, {
        conciertoId: concertId,
        qrToken: validQrToken,
      });

      expect(res.valido).toBe(false);
      expect(res.resultado).toBe(ValidacionResultado.YA_UTILIZADO);
      expect(res.mensaje).toMatch(/ENTRADA YA UTILIZADA/i);
    });

    it('rechaza la validación si el ticket pertenece a otro concierto', async () => {
      mockTicket.conciertoId = 'otro-concierto-id';

      const res = await service.validarIngresoQR(verifierUserId1, {
        conciertoId: concertId,
        qrToken: validQrToken,
      });

      expect(res.valido).toBe(false);
      expect(res.resultado).toBe(ValidacionResultado.EVENTO_INCORRECTO);
      expect(res.mensaje).toMatch(/Entrada inválida para este concierto/i);
    });

    it('rechaza la validación de un QR no reconocido o corrupto', async () => {
      const qr: any = mockDataSource.createQueryRunner();
      qr.manager.createQueryBuilder = vi.fn(() => ({
        setLock: vi.fn().mockReturnThis(),
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn(async () => null), // Ticket no existe
      }));

      const res = await service.validarIngresoQR(verifierUserId1, {
        conciertoId: concertId,
        qrToken: 'TOKEN_INVENTADO_O_FALSO',
      });

      expect(res.valido).toBe(false);
      expect(res.resultado).toBe(ValidacionResultado.NO_ENCONTRADO);
    });

    it('concurrencia: si dos verificadores escanean simultáneamente el mismo ticket, solo uno lo valida', async () => {
      let yaValidado = false;

      const qr: any = mockDataSource.createQueryRunner();
      qr.manager.createQueryBuilder = vi.fn(() => ({
        setLock: vi.fn().mockReturnThis(),
        innerJoinAndSelect: vi.fn().mockReturnThis(),
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getOne: vi.fn(async () => {
          if (yaValidado) {
            return {
              ...mockTicket,
              estado: TicketEstado.UTILIZADO,
              fechaUtilizado: new Date(),
            };
          }
          yaValidado = true;
          return {
            ...mockTicket,
            estado: TicketEstado.VIGENTE,
          };
        }),
      }));

      // Primer escaneo concurrente
      const v1 = await service.validarIngresoQR(verifierUserId1, {
        conciertoId: concertId,
        qrToken: validQrToken,
      });
      expect(v1.valido).toBe(true);
      expect(v1.resultado).toBe(ValidacionResultado.EXITOSO);

      // Segundo escaneo concurrente del mismo ticket
      const v2 = await service.validarIngresoQR(verifierUserId1, {
        conciertoId: concertId,
        qrToken: validQrToken,
      });
      expect(v2.valido).toBe(false);
      expect(v2.resultado).toBe(ValidacionResultado.YA_UTILIZADO);
    });
  });

  describe('Gestión de Verificadores por el Organizador', () => {
    it('permite al organizador asignar un verificador a su concierto', async () => {
      const res = await service.asignarVerificador(orgUserId, concertId, {
        usuarioId: verifierUserId2,
      });

      expect(res.success).toBe(true);
      expect(res.asignacionId).toBeDefined();
    });

    it('rechaza asignar un usuario que no tiene el rol VERIFICADOR', async () => {
      mockUsuariosRepo.findOne = vi.fn(async () => ({
        id: buyerUserId1,
        roles: [{ nombre: RolNombre.CLIENTE }],
      }));

      await expect(
        service.asignarVerificador(orgUserId, concertId, {
          usuarioId: buyerUserId1,
        }),
      ).rejects.toThrow(/no cuenta con el rol VERIFICADOR/i);
    });
  });
});
