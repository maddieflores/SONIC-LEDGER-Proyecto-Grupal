import { describe, expect, it, beforeAll, afterAll } from 'vitest';
import dataSource from '../data-source.js';
import { TicketingService } from './ticketing.service.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { OrdenCompra, OrdenEstado } from './orden-compra.entity.js';
import { OrdenItem } from './orden-item.entity.js';
import { ReservaCupo } from './reserva-cupo.entity.js';
import { Ticket, TicketEstado } from './ticket.entity.js';
import { ConciertoVerificador } from './concierto-verificador.entity.js';
import { TicketValidacion, ValidacionResultado } from './ticket-validacion.entity.js';
import { Concierto, ConciertoEstado } from '../conciertos/concierto.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { ConciertoArtista } from '../conciertos/concierto-artista.entity.js';
import { ConciertosService } from '../conciertos/conciertos.service.js';
import { Artista } from '../musica/artista.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { Rol, RolNombre } from '../auth/rol.entity.js';
import { randomBytes } from 'node:crypto';

describe('CU20, CU22 & CU17 — Pruebas de Concurrencia Real en PostgreSQL', () => {
  let service: TicketingService;
  let conciertosService: ConciertosService;
  let testOrg: Usuario;
  let buyer1: Usuario;
  let buyer2: Usuario;
  let verifier1: Usuario;
  let verifier2: Usuario;
  let testConcert: Concierto;
  let singleSeatCategory: ConciertoCategoria;

  beforeAll(async () => {
    if (!dataSource.isInitialized) {
      await dataSource.initialize();
    }

    const userRepo = dataSource.getRepository(Usuario);
    const rolRepo = dataSource.getRepository(Rol);
    const concertRepo = dataSource.getRepository(Concierto);
    const catRepo = dataSource.getRepository(ConciertoCategoria);
    const verifRepo = dataSource.getRepository(ConciertoVerificador);

    const orgRole = await rolRepo.findOneBy({ nombre: RolNombre.ORGANIZADOR });
    const clienteRole = await rolRepo.findOneBy({ nombre: RolNombre.CLIENTE });
    const verifRole = await rolRepo.findOneBy({ nombre: RolNombre.VERIFICADOR });

    // 1. Crear usuarios de prueba reales
    testOrg = await userRepo.save(
      userRepo.create({
        username: `org_conc_${Date.now()}`,
        email: `org_conc_${Date.now()}@example.com`,
        passwordHash: 'hash',
        roles: [clienteRole!, orgRole!],
      }),
    );

    buyer1 = await userRepo.save(
      userRepo.create({
        username: `b1_conc_${Date.now()}`,
        email: `b1_conc_${Date.now()}@example.com`,
        passwordHash: 'hash',
        roles: [clienteRole!],
      }),
    );

    buyer2 = await userRepo.save(
      userRepo.create({
        username: `b2_conc_${Date.now()}`,
        email: `b2_conc_${Date.now()}@example.com`,
        passwordHash: 'hash',
        roles: [clienteRole!],
      }),
    );

    verifier1 = await userRepo.save(
      userRepo.create({
        username: `v1_conc_${Date.now()}`,
        email: `v1_conc_${Date.now()}@example.com`,
        passwordHash: 'hash',
        roles: [clienteRole!, verifRole!],
      }),
    );

    verifier2 = await userRepo.save(
      userRepo.create({
        username: `v2_conc_${Date.now()}`,
        email: `v2_conc_${Date.now()}@example.com`,
        passwordHash: 'hash',
        roles: [clienteRole!, verifRole!],
      }),
    );

    // 2. Crear concierto publicado real
    testConcert = await concertRepo.save(
      concertRepo.create({
        organizadorId: testOrg.id,
        titulo: `Concierto Concurrente ${Date.now()}`,
        descripcion: 'Pruebas de concurrencia real PostgreSQL',
        genero: 'Metal',
        fechaInicio: new Date(Date.now() + 86400000 * 5),
        fechaFin: new Date(Date.now() + 86400000 * 5 + 3600000 * 4),
        zonaHoraria: 'America/La_Paz',
        recinto: 'Teatro Real',
        direccion: 'Calle Ficticia 123',
        ciudad: 'La Paz',
        departamento: 'La Paz',
        estado: ConciertoEstado.PUBLICADO,
        inicioVenta: new Date(Date.now() - 3600000),
      }),
    );

    // 3. Crear categoría con EXACTAMENTE 1 solo cupo disponible
    singleSeatCategory = await catRepo.save(
      catRepo.create({
        conciertoId: testConcert.id,
        nombre: 'Única Butaca VIP',
        precio: 200,
        moneda: 'BOB',
        cupoTotal: 1,
        cupoDisponible: 1,
        disponible: true,
      }),
    );

    // 4. Asignar verificadores al concierto
    await verifRepo.save([
      verifRepo.create({
        conciertoId: testConcert.id,
        usuarioId: verifier1.id,
        asignadoPor: testOrg.id,
        activo: true,
      }),
      verifRepo.create({
        conciertoId: testConcert.id,
        usuarioId: verifier2.id,
        asignadoPor: testOrg.id,
        activo: true,
      }),
    ]);

    service = new TicketingService(
      dataSource,
      dataSource.getRepository(OrdenCompra),
      dataSource.getRepository(OrdenItem),
      dataSource.getRepository(ReservaCupo),
      dataSource.getRepository(Ticket),
      dataSource.getRepository(ConciertoVerificador),
      dataSource.getRepository(TicketValidacion),
      dataSource.getRepository(Concierto),
      dataSource.getRepository(ConciertoCategoria),
      dataSource.getRepository(Usuario),
      new MockPaymentProvider(),
    );

    conciertosService = new ConciertosService(
      dataSource.getRepository(Concierto),
      dataSource.getRepository(ConciertoArtista),
      dataSource.getRepository(ConciertoCategoria),
      dataSource.getRepository(Artista),
      dataSource.getRepository(Usuario),
      dataSource,
    );
  }, 30000);

  afterAll(async () => {
    if (dataSource.isInitialized && testConcert) {
      try {
        await dataSource.getRepository(Concierto).delete({ id: testConcert.id });
        await dataSource.getRepository(Usuario).delete([
          testOrg.id,
          buyer1.id,
          buyer2.id,
          verifier1.id,
          verifier2.id,
        ]);
      } catch {
        // Ignorar limpieza
      }
    }
  });

  it('CU20 Concurrencia PostgreSQL: dos compradores compiten simultáneamente por el último cupo -> sin sobreventa', async () => {
    const payload = {
      conciertoId: testConcert.id,
      categoriaId: singleSeatCategory.id,
      cantidad: 1,
    };

    // Lanzar dos compras de manera verdaderamente concurrente contra PostgreSQL
    const results = await Promise.allSettled([
      service.crearReservaOrden(buyer1.id, { ...payload, operacionId: `OP-E2E-1-${Date.now()}` }),
      service.crearReservaOrden(buyer2.id, { ...payload, operacionId: `OP-E2E-2-${Date.now()}` }),
    ]);

    const exitosos = results.filter((r) => r.status === 'fulfilled');
    const rechazados = results.filter((r) => r.status === 'rejected');

    // Exactamente 1 exitoso y 1 rechazado
    expect(exitosos.length).toBe(1);
    expect(rechazados.length).toBe(1);

    // Verificar en la base de datos real que el cupo disponible no quedó negativo
    const catFinal = await dataSource.getRepository(ConciertoCategoria).findOneBy({
      id: singleSeatCategory.id,
    });
    expect(catFinal?.cupoDisponible).toBe(0);
  });

  it('CU22 Concurrencia PostgreSQL: dos verificadores validan simultáneamente el mismo ticket -> solo uno tiene éxito', async () => {
    // 1. Emitir un ticket real para el concierto
    const ticketRepo = dataSource.getRepository(Ticket);
    const realTicket = await ticketRepo.save(
      ticketRepo.create({
        ordenId: (await dataSource.getRepository(OrdenCompra).findOneBy({ conciertoId: testConcert.id }))!.id,
        conciertoId: testConcert.id,
        categoriaId: singleSeatCategory.id,
        usuarioId: buyer1.id,
        estado: TicketEstado.VIGENTE,
        codigoPublico: `SL-TK-CONC-${randomBytes(4).toString('hex').toUpperCase()}`,
        qrToken: `SLQR_CONCURRENCY_${randomBytes(24).toString('hex')}`,
        fechaEmision: new Date(),
      }),
    );

    // 2. Lanzar validaciones simultáneas desde dos conexiones distintas
    const results = await Promise.all([
      service.validarIngresoQR(verifier1.id, {
        conciertoId: testConcert.id,
        qrToken: realTicket.qrToken,
      }),
      service.validarIngresoQR(verifier2.id, {
        conciertoId: testConcert.id,
        qrToken: realTicket.qrToken,
      }),
    ]);

    const exitoso = results.filter((r) => r.valido && r.resultado === ValidacionResultado.EXITOSO);
    const repetido = results.filter((r) => !r.valido && r.resultado === ValidacionResultado.YA_UTILIZADO);

    // Exactamente 1 ingreso exitoso y 1 detectado como YA_UTILIZADO
    expect(exitoso.length).toBe(1);
    expect(repetido.length).toBe(1);

    // Verificar en la BD real que el ticket quedó como UTILIZADO
    const ticketFinal = await ticketRepo.findOneBy({ id: realTicket.id });
    expect(ticketFinal?.estado).toBe(TicketEstado.UTILIZADO);
    expect(ticketFinal?.fechaUtilizado).toBeDefined();
  });

  it('CU17 Concurrencia PostgreSQL: compra confirmándose concurrentemente con cancelación de concierto -> consistencia garantizada y 0 tickets utilizables', async () => {
    const concertRepo = dataSource.getRepository(Concierto);
    const catRepo = dataSource.getRepository(ConciertoCategoria);
    const ticketRepo = dataSource.getRepository(Ticket);
    const orderRepo = dataSource.getRepository(OrdenCompra);

    // 1. Crear un concierto dedicado para la prueba concurrente
    const cancelConcert = await concertRepo.save(
      concertRepo.create({
        organizadorId: testOrg.id,
        titulo: `Concierto Cancelación Concurrente ${Date.now()}`,
        descripcion: 'Prueba de consistencia transaccional CU17',
        genero: 'Rock',
        fechaInicio: new Date(Date.now() + 86400000 * 3),
        fechaFin: new Date(Date.now() + 86400000 * 3 + 3600000 * 3),
        zonaHoraria: 'America/La_Paz',
        recinto: 'Teatro Municipal',
        direccion: 'Calle Sucre 100',
        ciudad: 'Cochabamba',
        departamento: 'Cochabamba',
        estado: ConciertoEstado.PUBLICADO,
        inicioVenta: new Date(Date.now() - 3600000),
      }),
    );

    const testCat = await catRepo.save(
      catRepo.create({
        conciertoId: cancelConcert.id,
        nombre: 'General',
        precio: 150,
        moneda: 'BOB',
        cupoTotal: 10,
        cupoDisponible: 10,
        disponible: true,
      }),
    );

    // 2. Comprador crea una reserva/orden pendiente
    const pendingOrder = await service.crearReservaOrden(buyer1.id, {
      conciertoId: cancelConcert.id,
      categoriaId: testCat.id,
      cantidad: 1,
    });

    // 3. Ejecutar simultáneamente: Comprador procesa el pago <-> Organizador cancela el concierto
    await Promise.allSettled([
      service.procesarPago(buyer1.id, {
        ordenId: pendingOrder.id,
        simularResultado: 'APROBADO',
      }),
      conciertosService.cancelarConcierto(
        testOrg.id,
        cancelConcert.id,
        { motivo: 'Cancelación concurrente por emergencia' },
        [RolNombre.ORGANIZADOR],
      ),
    ]);

    // 4. Verificaciones de consistencia en PostgreSQL
    const finalConcert = await concertRepo.findOneBy({ id: cancelConcert.id });
    expect(finalConcert?.estado).toBe(ConciertoEstado.CANCELADO);
    expect(finalConcert?.motivoCancelacion).toBe('Cancelación concurrente por emergencia');

    // NINGÚN ticket puede quedar como VIGENTE para un concierto cancelado
    const usableTickets = await ticketRepo.find({
      where: { conciertoId: cancelConcert.id, estado: TicketEstado.VIGENTE },
    });
    expect(usableTickets.length).toBe(0);

    // Si se emitieron tickets antes de que la cancelación tomara el lock, deben estar como INVALIDADO
    const allTickets = await ticketRepo.find({
      where: { conciertoId: cancelConcert.id },
    });
    for (const t of allTickets) {
      expect(t.estado).toBe(TicketEstado.INVALIDADO);
    }

    // La orden debe estar CANCELADA o con PENDIENTE_REEMBOLSO si se cobró
    const finalOrder = await orderRepo.findOneBy({ id: pendingOrder.id });
    expect(
      finalOrder?.estado === OrdenEstado.CANCELADA ||
        finalOrder?.reembolsoEstado === 'PENDIENTE_REEMBOLSO',
    ).toBe(true);

    // Limpieza
    try {
      await concertRepo.delete({ id: cancelConcert.id });
    } catch {}
  });
});
