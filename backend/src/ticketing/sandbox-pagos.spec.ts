import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  TicketingService,
} from './ticketing.service.js';
import {
  OrdenCompra,
  OrdenEstado,
  ReembolsoEstado,
} from './orden-compra.entity.js';
import {
  Reembolso,
  ReembolsoEstadoOperacion,
  ReembolsoTipo,
} from './reembolso.entity.js';
import { Concierto, ConciertoEstado } from '../conciertos/concierto.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { Ticket, TicketEstado } from './ticket.entity.js';
import { ReservaCupo } from './reserva-cupo.entity.js';
import { SandboxGatewayService } from '../sandbox-gateway/sandbox-gateway.service.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('Sandbox de Pagos y Reembolsos Simulados', () => {
  let ticketingService: TicketingService;
  let sandboxService: SandboxGatewayService;
  let mockOrdenesRepo: any;
  let mockReembolsosRepo: any;
  let mockConciertosRepo: any;
  let mockCategoriasRepo: any;
  let mockTicketsRepo: any;
  let mockReservasRepo: any;
  let mockVerificadoresRepo: any;
  let mockValidacionesRepo: any;
  let mockUsuariosRepo: any;
  let mockDataSource: any;

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.SANDBOX_GATEWAY_ENABLED = 'true';
    process.env.SANDBOX_MERCHANT_ID = 'SONIC_LEDGER_LOCAL_SANDBOX';
    process.env.SANDBOX_API_KEY = 'test_key_for_vitest_runner';
    process.env.SANDBOX_WEBHOOK_SECRET = 'test_secret_for_vitest_runner';

    sandboxService = new SandboxGatewayService();

    mockOrdenesRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn((o) => Promise.resolve(o)),
      create: vi.fn((o) => ({ ...o, id: 'orden-uuid-1' })),
    };

    mockReembolsosRepo = {
      findOne: vi.fn(),
      find: vi.fn(),
      save: vi.fn((r) => Promise.resolve({ ...r, id: r.id || 'reembolso-uuid-1' })),
      create: vi.fn((r) => ({ ...r, id: 'reembolso-uuid-1' })),
    };

    mockConciertosRepo = {
      findOne: vi.fn(),
    };

    mockCategoriasRepo = {
      findOne: vi.fn(),
    };

    mockTicketsRepo = {
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn((t) => Promise.resolve(t)),
      create: vi.fn((t) => ({ ...t, id: 'ticket-uuid-1' })),
    };

    mockReservasRepo = {
      find: vi.fn(),
      save: vi.fn(),
    };

    mockVerificadoresRepo = {};
    mockValidacionesRepo = {};
    mockUsuariosRepo = {};

    const mockQueryRunner = {
      connect: vi.fn(),
      startTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      rollbackTransaction: vi.fn(),
      release: vi.fn(),
      manager: {
        createQueryBuilder: vi.fn(),
        save: vi.fn((entityClass, obj) => Promise.resolve(obj || entityClass)),
        create: vi.fn((entityClass, obj) => ({ ...obj, id: 'mock-gen-id' })),
        count: vi.fn().mockResolvedValue(0),
      },
    };

    mockDataSource = {
      createQueryRunner: vi.fn(() => mockQueryRunner),
      createQueryBuilder: vi.fn(() => ({
        update: vi.fn().mockReturnThis(),
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        execute: vi.fn().mockResolvedValue({ affected: 1 }),
      })),
    };

    ticketingService = new TicketingService(
      mockDataSource,
      mockOrdenesRepo,
      {} as any,
      mockReservasRepo,
      mockTicketsRepo,
      mockVerificadoresRepo,
      mockValidacionesRepo,
      mockConciertosRepo,
      mockCategoriasRepo,
      mockUsuariosRepo,
      new MockPaymentProvider(),
      mockReembolsosRepo,
      sandboxService,
    );
  });

  // 1. Pago aprobado y emisión de ticket
  it('1. procesa pago aprobado y emite tickets en estado VIGENTE', async () => {
    const orden = {
      id: 'ord-100',
      usuarioId: 'user-1',
      conciertoId: 'con-1',
      estado: OrdenEstado.PENDIENTE,
      total: 150,
      moneda: 'BOB',
      expiraEn: new Date(Date.now() + 600000),
      items: [
        {
          id: 'item-1',
          categoriaId: 'cat-1',
          cantidad: 1,
          precioUnitario: 150,
          subtotal: 150,
          categoria: { id: 'cat-1', nombre: 'VIP' },
        },
      ],
      concierto: { id: 'con-1', titulo: 'Rock Fest', estado: ConciertoEstado.PUBLICADO },
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    const qb = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(orden.concierto),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const qr = mockDataSource.createQueryRunner();
    qr.manager.createQueryBuilder.mockReturnValue(qb);

    const res = await ticketingService.procesarPago('user-1', {
      ordenId: 'ord-100',
      simularResultado: 'APROBADO',
    });

    expect(res.orden.estado).toBe(OrdenEstado.CONFIRMADA);
    expect(qr.manager.save).toHaveBeenCalled();
  });

  // 2. Pago rechazado
  it('2. procesa pago rechazado, actualiza estado a FALLIDA y libera cupos', async () => {
    const orden = {
      id: 'ord-101',
      usuarioId: 'user-1',
      conciertoId: 'con-1',
      estado: OrdenEstado.PENDIENTE,
      total: 80,
      moneda: 'BOB',
      expiraEn: new Date(Date.now() + 600000),
      items: [{ categoriaId: 'cat-1', cantidad: 1 }],
      concierto: { id: 'con-1', estado: ConciertoEstado.PUBLICADO },
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    const qb = {
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue(orden.concierto),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue({ affected: 1 }),
    };

    const qr = mockDataSource.createQueryRunner();
    qr.manager.createQueryBuilder.mockReturnValue(qb);

    await expect(
      ticketingService.procesarPago('user-1', {
        ordenId: 'ord-101',
        simularResultado: 'RECHAZADO',
      }),
    ).rejects.toThrow(BadRequestException);

    expect(orden.estado).toBe(OrdenEstado.FALLIDA);
  });

  // 4. Solicitud de reembolso pendiente
  it('4. crea solicitud de reembolso en estado PENDIENTE para una orden pagada', async () => {
    const orden = {
      id: 'ord-200',
      usuarioId: 'user-1',
      conciertoId: 'con-1',
      estado: OrdenEstado.CONFIRMADA,
      total: 200,
      moneda: 'BOB',
      montoReembolsado: 0,
      concierto: { organizadorId: 'org-1' },
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    const res = await ticketingService.solicitarReembolso('user-1', {
      ordenId: 'ord-200',
      motivo: 'Solicitud voluntaria de devolución',
    });

    expect(res.estado).toBe(ReembolsoEstadoOperacion.PENDIENTE);
    expect(res.monto).toBe(200);
    expect(res.tipo).toBe(ReembolsoTipo.TOTAL);
    expect(mockReembolsosRepo.save).toHaveBeenCalled();
  });

  // 5. Reembolso total simulado
  it('5. completa un reembolso total, actualizando orden a REEMBOLSADO', async () => {
    const reembolso = {
      id: 'ref-1',
      ordenId: 'ord-300',
      monto: 150,
      estado: ReembolsoEstadoOperacion.PENDIENTE,
    };

    const orden = {
      id: 'ord-300',
      total: 150,
      montoReembolsado: 0,
      reembolsoEstado: ReembolsoEstado.PENDIENTE_REEMBOLSO,
    };

    const qr = mockDataSource.createQueryRunner();
    qr.manager.createQueryBuilder.mockReturnValue({
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn()
        .mockResolvedValueOnce(reembolso) // Reembolso
        .mockResolvedValueOnce(orden), // Orden
    });

    const res = await ticketingService.procesarReembolso('ref-1', 'COMPLETAR', 'Aprobado en sandbox');

    expect(res.estado).toBe(ReembolsoEstadoOperacion.COMPLETADO);
    expect(orden.montoReembolsado).toBe(150);
    expect(orden.reembolsoEstado).toBe(ReembolsoEstado.REEMBOLSADO);
  });

  // 6. Reembolso parcial simulado
  it('6. procesa reembolso parcial y asigna estado REEMBOLSO_PARCIAL a la orden', async () => {
    const reembolso = {
      id: 'ref-2',
      ordenId: 'ord-301',
      monto: 50,
      estado: ReembolsoEstadoOperacion.PENDIENTE,
    };

    const orden = {
      id: 'ord-301',
      total: 150,
      montoReembolsado: 0,
      reembolsoEstado: ReembolsoEstado.PENDIENTE_REEMBOLSO,
    };

    const qr = mockDataSource.createQueryRunner();
    qr.manager.createQueryBuilder.mockReturnValue({
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn()
        .mockResolvedValueOnce(reembolso)
        .mockResolvedValueOnce(orden),
    });

    const res = await ticketingService.procesarReembolso('ref-2', 'COMPLETAR');

    expect(res.estado).toBe(ReembolsoEstadoOperacion.COMPLETADO);
    expect(orden.montoReembolsado).toBe(50);
    expect(orden.reembolsoEstado).toBe(ReembolsoEstado.REEMBOLSO_PARCIAL);
  });

  // 7. Reembolso fallido y reintento
  it('7. registra fallo de reembolso y permite reintentarlo retornando a PENDIENTE', async () => {
    const reembolso = {
      id: 'ref-3',
      ordenId: 'ord-302',
      monto: 80,
      estado: ReembolsoEstadoOperacion.FALLIDO,
      orden: {
        usuarioId: 'user-1',
        concierto: { organizadorId: 'org-1' },
      },
    };

    mockReembolsosRepo.findOne.mockResolvedValue(reembolso);

    const reintento = await ticketingService.reintentarReembolso('ref-3', 'user-1');
    expect(reintento.estado).toBe(ReembolsoEstadoOperacion.PENDIENTE);
    expect(mockReembolsosRepo.save).toHaveBeenCalled();
  });

  // 8. Reembolso duplicado / idempotencia
  it('8. retorna el reembolso existente cuando se usa la misma clave de idempotencia', async () => {
    const orden = {
      id: 'ord-400',
      usuarioId: 'user-1',
      estado: OrdenEstado.CONFIRMADA,
      total: 100,
      montoReembolsado: 0,
      concierto: { organizadorId: 'org-1' },
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    const reembolsoExistente = {
      id: 'ref-existente',
      ordenId: 'ord-400',
      monto: 100,
      estado: ReembolsoEstadoOperacion.PENDIENTE,
      idempotencyKey: 'IDEMP-123',
      createdAt: new Date(),
    };

    mockReembolsosRepo.findOne.mockResolvedValue(reembolsoExistente);

    const res = await ticketingService.solicitarReembolso('user-1', {
      ordenId: 'ord-400',
      motivo: 'Duplicado',
      idempotencyKey: 'IDEMP-123',
    });

    expect(res.id).toBe('ref-existente');
    expect(mockReembolsosRepo.create).not.toHaveBeenCalled();
  });

  // 9. Webhook duplicado (idempotencia)
  it('9. ignora con éxito un webhook duplicado de pago ya confirmado sin crear tickets dobles', async () => {
    const orden = {
      id: 'ord-500',
      estado: OrdenEstado.CONFIRMADA,
      items: [],
      concierto: { estado: ConciertoEstado.PUBLICADO },
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    const payload = JSON.stringify({
      id: 'evt-dup-1',
      event: 'payment.succeeded',
      data: { orderId: 'ord-500', transactionId: 'TX-DUP' },
    });

    const signature = sandboxService.computeSignature(payload);

    const res = await ticketingService.procesarWebhookSandbox(payload, signature);
    expect(res.received).toBe(true);
    expect(res.status).toBe('ALREADY_CONFIRMED');
  });

  // 10. Webhook con firma inválida
  it('10. rechaza con UnauthorizedException un webhook con firma o secreto incorrecto', async () => {
    const payload = JSON.stringify({
      id: 'evt-tampered',
      event: 'payment.succeeded',
      data: { orderId: 'ord-hack' },
    });

    const firmaFalsa = 'deadbeef1234567890abcdefdeadbeef1234567890abcdefdeadbeef12345678';

    await expect(
      ticketingService.procesarWebhookSandbox(payload, firmaFalsa),
    ).rejects.toThrow(UnauthorizedException);
  });

  // 11. Importe superior al pagado
  it('11. rechaza una solicitud de reembolso que supere el total de la orden', async () => {
    const orden = {
      id: 'ord-600',
      usuarioId: 'user-1',
      estado: OrdenEstado.CONFIRMADA,
      total: 100,
      montoReembolsado: 50,
      concierto: { organizadorId: 'org-1' },
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    await expect(
      ticketingService.solicitarReembolso('user-1', {
        ordenId: 'ord-600',
        monto: 60, // 50 + 60 = 110 > 100
        motivo: 'Exceso',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // 12. Compra confirmada durante cancelación de concierto
  it('12. webhook recibido cuando el concierto ya fue cancelado pasa la orden a CANCELADA con reembolso pendiente', async () => {
    const orden = {
      id: 'ord-700',
      conciertoId: 'con-cancelado',
      usuarioId: 'user-1',
      estado: OrdenEstado.PENDIENTE,
      total: 120,
      items: [],
    };

    mockOrdenesRepo.findOne.mockResolvedValue(orden);

    const qr = mockDataSource.createQueryRunner();
    qr.manager.createQueryBuilder.mockReturnValue({
      setLock: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getOne: vi.fn().mockResolvedValue({
        id: 'con-cancelado',
        estado: ConciertoEstado.CANCELADO,
      }),
    });

    const payload = JSON.stringify({
      id: 'evt-race-1',
      event: 'payment.succeeded',
      data: { orderId: 'ord-700', transactionId: 'TX-RACE' },
    });

    const sig = sandboxService.computeSignature(payload);
    const res = await ticketingService.procesarWebhookSandbox(payload, sig);

    expect(res.status).toBe('CONCERT_CANCELLED');
    expect(orden.estado).toBe(OrdenEstado.CANCELADA);
    expect(orden.reembolsoEstado).toBe(ReembolsoEstado.PENDIENTE_REEMBOLSO);
  });

  // 13. Persistencia y consulta de reembolsos de organizador
  it('13. calcula los agregados correctos de solicitudes de devolución para el organizador', async () => {
    mockConciertosRepo.findOne.mockResolvedValue({
      id: 'con-800',
      organizadorId: 'org-1',
    });

    mockReembolsosRepo.find.mockResolvedValue([
      { monto: 100, estado: ReembolsoEstadoOperacion.COMPLETADO },
      { monto: 50, estado: ReembolsoEstadoOperacion.PENDIENTE },
      { monto: 20, estado: ReembolsoEstadoOperacion.FALLIDO },
    ]);

    const res = await ticketingService.obtenerReembolsosOrganizador('org-1', 'con-800');

    expect(res.totalSolicitudes).toBe(3);
    expect(res.completados).toBe(1);
    expect(res.pendientes).toBe(1);
    expect(res.fallidos).toBe(1);
    expect(res.montoCompletadoBob).toBe(100);
    expect(res.montoPendienteBob).toBe(50);
    expect(res.montoFallidoBob).toBe(20);
  });

  // 14. Seguridad: falla de forma segura si falta la configuración de entorno
  it('14. falla de forma segura con ForbiddenException si faltan variables de entorno del sandbox', () => {
    delete process.env.SANDBOX_API_KEY;
    delete process.env.SANDBOX_WEBHOOK_SECRET;

    expect(() => sandboxService.assertSimulatorAllowed()).toThrow();
    expect(() => sandboxService.createPaymentSession('ord-sec-1', 100)).toThrow();
  });

  // 15. Seguridad: rechaza operaciones si el entorno es de producción
  it('15. rechaza cualquier operación del simulador si NODE_ENV es production', () => {
    process.env.NODE_ENV = 'production';
    expect(() => sandboxService.assertSimulatorAllowed()).toThrow();
    expect(() => sandboxService.createRefundSession('ord-sec-2', 50, 'Prueba')).toThrow();
  });

  // 16. Seguridad: rechaza operaciones si SANDBOX_GATEWAY_ENABLED es false
  it('16. rechaza operaciones si SANDBOX_GATEWAY_ENABLED está configurado en false', () => {
    process.env.SANDBOX_GATEWAY_ENABLED = 'false';
    expect(() => sandboxService.assertSimulatorAllowed()).toThrow();
  });

  // 17. Seguridad: validación de firma HMAC SHA-256 en tiempo constante
  it('17. valida firmas HMAC SHA-256 de forma estricta y rechaza firmas manipuladas', () => {
    process.env.SANDBOX_WEBHOOK_SECRET = 'secreto_seguro_de_prueba_123';
    const payload = JSON.stringify({ evento: 'test', orden: '123' });
    const firmaValida = sandboxService.computeSignature(payload);

    expect(sandboxService.verifySignature(payload, firmaValida)).toBe(true);
    expect(sandboxService.verifySignature(payload, 'deadbeef')).toBe(false);
    expect(sandboxService.verifySignature(payload + 'alterado', firmaValida)).toBe(false);
  });
});
