import { describe, expect, it, vi, beforeEach } from 'vitest';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { EstadisticasService } from './estadisticas.service.js';
import { Concierto, ConciertoEstado } from '../conciertos/concierto.entity.js';
import { OrdenEstado, ReembolsoEstado } from './orden-compra.entity.js';
import { TicketEstado } from './ticket.entity.js';
import { RolNombre } from '../auth/rol.entity.js';

describe('CU24 — Consultar Ventas y Asistencia', () => {
  let service: EstadisticasService;
  let mockDataSource: any;
  let mockConciertosRepo: any;
  let mockCategoriasRepo: any;
  let mockOrdenesRepo: any;
  let mockTicketsRepo: any;
  let mockReservasRepo: any;

  const organizerId = 'organizer-uuid-1';
  const otherOrganizerId = 'organizer-uuid-2';
  const concertId = 'concert-uuid-1';

  let mockConcert: any;

  beforeEach(() => {
    mockConcert = {
      id: concertId,
      organizadorId: organizerId,
      titulo: 'Sinfonía Andina en Vivo',
      estado: ConciertoEstado.PUBLICADO,
      fechaInicio: new Date('2026-12-20T20:00:00Z'),
      recinto: 'Campo Ferial Chuquiago Marka',
      ciudad: 'La Paz',
      motivoCancelacion: null,
      canceladoEn: null,
      categorias: [
        {
          id: 'cat-vip',
          nombre: 'VIP Neón',
          precio: 250,
          moneda: 'BOB',
          cupoTotal: 100,
          cupoDisponible: 60,
        },
        {
          id: 'cat-gen',
          nombre: 'General',
          precio: 100,
          moneda: 'BOB',
          cupoTotal: 400,
          cupoDisponible: 250,
        },
      ],
    };

    mockConciertosRepo = {
      findOne: vi.fn(async (opts: any) => {
        if (opts.where?.id === concertId) return mockConcert;
        return null;
      }),
      find: vi.fn(async () => [mockConcert]),
    };

    mockCategoriasRepo = { find: vi.fn(async () => mockConcert.categorias) };
    mockOrdenesRepo = {
      find: vi.fn(async () => [
        { id: 'o-1', total: 500, estado: OrdenEstado.CONFIRMADA },
        { id: 'o-2', total: 250, estado: OrdenEstado.CONFIRMADA },
      ]),
      count: vi.fn(async () => 2),
    };

    mockTicketsRepo = {
      count: vi.fn(async (opts: any) => {
        if (opts?.where?.estado === TicketEstado.UTILIZADO) return 25;
        if (opts?.where?.estado === TicketEstado.VIGENTE) return 50;
        return 75; // Total tickets
      }),
    };

    mockReservasRepo = { count: vi.fn(async () => 10) };

    mockDataSource = {
      query: vi.fn(async (sql: string, params: any[]) => {
        // 1. Reservas activas
        if (sql.includes('reservas_cupo r') && sql.includes('COALESCE(SUM(r.cantidad), 0)')) {
          return [{ total: 15 }];
        }
        // 2. Órdenes por estado
        if (sql.includes('FROM ordenes_compra') && sql.includes('GROUP BY estado')) {
          return [
            { estado: OrdenEstado.CONFIRMADA, cantidad_ordenes: 30, total_bob: 6500.5 },
            { estado: OrdenEstado.PENDIENTE, cantidad_ordenes: 5, total_bob: 1200 },
            { estado: OrdenEstado.EXPIRADA, cantidad_ordenes: 8, total_bob: 1800 },
          ];
        }
        // 3. Tickets por estado
        if (sql.includes('FROM tickets') && sql.includes('GROUP BY estado')) {
          return [
            { estado: TicketEstado.UTILIZADO, cantidad: 40 },
            { estado: TicketEstado.VIGENTE, cantidad: 60 },
            { estado: TicketEstado.INVALIDADO, cantidad: 2 },
          ];
        }
        // 4. Reembolsos pendientes
        if (sql.includes('reembolso_estado = $2')) {
          if (mockConcert.estado === ConciertoEstado.CANCELADO) {
            return [{ cantidad: 30, total_bob: 6500.5 }];
          }
          return [{ cantidad: 0, total_bob: 0 }];
        }
        // 5. Desglose por categoría
        if (sql.includes('FROM concierto_categorias cc') && sql.includes('GROUP BY cc.id')) {
          return [
            {
              categoria_id: 'cat-vip',
              nombre: 'VIP Neón',
              precio: '250.00',
              moneda: 'BOB',
              cupo_total: 100,
              cupo_disponible: 60,
              entradas_vendidas: 40,
              tickets_utilizados: 25,
              tickets_pendientes: 15,
              tickets_invalidados: 0,
            },
            {
              categoria_id: 'cat-gen',
              nombre: 'General',
              precio: '100.00',
              moneda: 'BOB',
              cupo_total: 400,
              cupo_disponible: 340,
              entradas_vendidas: 60,
              tickets_utilizados: 15,
              tickets_pendientes: 45,
              tickets_invalidados: 2,
            },
          ];
        }
        // 6. Reservas por categoría
        if (sql.includes('GROUP BY categoria_id')) {
          return [
            { categoria_id: 'cat-vip', reservas: 5 },
            { categoria_id: 'cat-gen', reservas: 10 },
          ];
        }
        return [];
      }),
    };

    service = new EstadisticasService(
      mockDataSource,
      mockConciertosRepo,
      mockCategoriasRepo,
      mockOrdenesRepo,
      mockTicketsRepo,
      mockReservasRepo,
    );
  });

  it('calcula métricas reales de ventas, ocupación y asistencia para el organizador', async () => {
    const stats = await service.obtenerEstadisticasConcierto(
      organizerId,
      concertId,
      [RolNombre.ORGANIZADOR],
    );

    expect(stats).toBeDefined();
    expect(stats.conciertoId).toBe(concertId);
    expect(stats.cupoTotal).toBe(500); // 100 + 400
    expect(stats.cuposDisponibles).toBe(310); // 60 + 250
    expect(stats.reservasActivas).toBe(15);
    expect(stats.ordenesConfirmadas).toBe(30);
    expect(stats.ordenesPendientes).toBe(5);
    expect(stats.ordenesFallidasOExpiradas).toBe(8);
    expect(stats.ingresosConfirmadosBob).toBe(6500.5);
    expect(stats.pagosPrueba).toBe(true);

    // Tickets
    expect(stats.ticketsEmitidos).toBe(102); // 40 + 60 + 2
    expect(stats.ticketsUtilizados).toBe(40);
    expect(stats.ticketsPendientesIngreso).toBe(60);
    expect(stats.ticketsInvalidados).toBe(2);

    // Tasa de asistencia = (40 / (40 + 60)) * 100 = 40.0%
    expect(stats.tasaAsistenciaPorcentaje).toBe(40);
    // Porcentaje ocupación = (102 / 500) * 100 = 20.4%
    expect(stats.porcentajeOcupacion).toBe(20.4);
  });

  it('incluye el desglose detallado por categoría con importes en BOB', async () => {
    const stats = await service.obtenerEstadisticasConcierto(
      organizerId,
      concertId,
      [RolNombre.ORGANIZADOR],
    );

    expect(stats.categorias.length).toBe(2);

    const catVip = stats.categorias.find((c) => c.categoriaId === 'cat-vip');
    expect(catVip).toBeDefined();
    expect(catVip!.nombre).toBe('VIP Neón');
    expect(catVip!.entradasVendidas).toBe(40);
    expect(catVip!.ingresosConfirmadosBob).toBe(10000); // 40 * 250
    expect(catVip!.ticketsUtilizados).toBe(25);
    expect(catVip!.porcentajeAsistencia).toBe(62.5); // (25 / 40) * 100
  });

  it('deniega acceso si un organizador intenta consultar estadísticas de un concierto ajeno', async () => {
    await expect(
      service.obtenerEstadisticasConcierto(
        otherOrganizerId,
        concertId,
        [RolNombre.ORGANIZADOR],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deniega acceso si un CLIENTE intenta consultar las estadísticas privadas', async () => {
    await expect(
      service.obtenerEstadisticasConcierto(
        'client-uuid',
        concertId,
        [RolNombre.CLIENTE],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('conserva estadísticas históricas e identifica reembolsos pendientes cuando el concierto está cancelado', async () => {
    mockConcert.estado = ConciertoEstado.CANCELADO;
    mockConcert.motivoCancelacion = 'Cancelado por fuerza mayor';
    mockConcert.canceladoEn = new Date();

    const stats = await service.obtenerEstadisticasConcierto(
      organizerId,
      concertId,
      [RolNombre.ORGANIZADOR],
    );

    expect(stats.esCancelado).toBe(true);
    expect(stats.motivoCancelacion).toBe('Cancelado por fuerza mayor');
    expect(stats.ordenesPendienteReembolso).toBe(30);
    expect(stats.montoPendienteReembolsoBob).toBe(6500.5);
    expect(stats.ingresosConfirmadosBob).toBe(6500.5); // Conserva trazabilidad histórica
  });

  it('genera resumen global de conciertos para el dashboard del organizador', async () => {
    const resumen = await service.obtenerResumenOrganizador(organizerId);

    expect(resumen.totalConciertos).toBe(1);
    expect(resumen.conciertosPublicados).toBe(1);
    expect(resumen.conciertos.length).toBe(1);
    expect(resumen.conciertos[0].titulo).toBe('Sinfonía Andina en Vivo');
    expect(resumen.pagosPrueba).toBe(true);
  });
});
