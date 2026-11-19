import { describe, expect, it, vi, beforeEach } from 'vitest';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConciertosService } from './conciertos.service.js';
import { Concierto, ConciertoEstado } from './concierto.entity.js';
import { RolNombre } from '../auth/rol.entity.js';
import { OrdenEstado, ReembolsoEstado } from '../ticketing/orden-compra.entity.js';
import { TicketEstado } from '../ticketing/ticket.entity.js';

describe('CU17 — Cancelar Concierto', () => {
  let service: ConciertosService;
  let mockConciertosRepo: any;
  let mockArtistasRepo: any;
  let mockCategoriasRepo: any;
  let mockPlatformArtistsRepo: any;
  let mockUsuariosRepo: any;
  let mockDataSource: any;

  const organizadorUserId = 'organizer-uuid-1';
  const otherOrganizerUserId = 'organizer-uuid-2';
  const clientUserId = 'client-uuid-1';
  const concertId = 'concert-uuid-1';

  let mockConcert: any;

  beforeEach(() => {
    mockConcert = {
      id: concertId,
      organizadorId: organizadorUserId,
      titulo: 'Illimani Metal Fest 2026',
      descripcion: 'Festival de rock y metal en vivo',
      estado: ConciertoEstado.PUBLICADO,
      recinto: 'Teatro al Aire Libre',
      ciudad: 'La Paz',
      departamento: 'La Paz',
      fechaInicio: new Date(Date.now() + 86400000 * 5),
      fechaFin: new Date(Date.now() + 86400000 * 5 + 3600000 * 4),
      inicioVenta: new Date(Date.now() - 86400000),
      motivoCancelacion: null,
      canceladoEn: null,
      canceladoPorId: null,
      artistas: [],
      categorias: [
        {
          id: 'cat-1',
          conciertoId: concertId,
          nombre: 'General',
          precio: 100,
          moneda: 'BOB',
          cupoTotal: 500,
          cupoDisponible: 450,
          disponible: true,
        },
      ],
      organizador: {
        id: organizadorUserId,
        username: 'rock_bolivia',
        displayName: 'Rock Bolivia Producciones',
      },
    };

    mockConciertosRepo = {
      findOne: vi.fn(async (opts: any) => {
        if (opts.where?.id === concertId) return mockConcert;
        return null;
      }),
      save: vi.fn(async (entity: any) => ({ ...mockConcert, ...entity })),
    };

    mockArtistasRepo = { find: vi.fn(async () => []), save: vi.fn() };
    mockCategoriasRepo = { find: vi.fn(async () => []), save: vi.fn() };
    mockPlatformArtistsRepo = { find: vi.fn(async () => []) };
    mockUsuariosRepo = { findOne: vi.fn(async () => null) };

    const mockQueryRunner = {
      connect: vi.fn(async () => {}),
      startTransaction: vi.fn(async () => {}),
      commitTransaction: vi.fn(async () => {}),
      rollbackTransaction: vi.fn(async () => {}),
      release: vi.fn(async () => {}),
      manager: {
        createQueryBuilder: vi.fn(() => ({
          setLock: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          set: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          execute: vi.fn(async () => ({ affected: 1 })),
          getOne: vi.fn(async () => mockConcert),
        })),
        save: vi.fn(async (_entityClass: any, entity: any) => {
          Object.assign(mockConcert, entity);
          return mockConcert;
        }),
      },
    };

    mockDataSource = {
      createQueryRunner: vi.fn(() => mockQueryRunner),
      getRepository: vi.fn((_entity: any) => ({
        count: vi.fn(async () => 15),
        find: vi.fn(async () => [
          { id: 'ord-1', total: 300, estado: OrdenEstado.CONFIRMADA },
          { id: 'ord-2', total: 200, estado: OrdenEstado.CONFIRMADA },
        ]),
      })),
    };

    service = new ConciertosService(
      mockConciertosRepo,
      mockArtistasRepo,
      mockCategoriasRepo,
      mockPlatformArtistsRepo,
      mockUsuariosRepo,
      mockDataSource,
    );
  });

  it('permite al organizador propietario cancelar su concierto publicado con motivo obligatorio', async () => {
    const res = await service.cancelarConcierto(
      organizadorUserId,
      concertId,
      { motivo: 'Emergencia climática y condiciones del recinto' },
      [RolNombre.ORGANIZADOR],
    );

    expect(res.success).toBe(true);
    expect(res.concierto.estado).toBe(ConciertoEstado.CANCELADO);
    expect(res.concierto.motivoCancelacion).toBe('Emergencia climática y condiciones del recinto');
    expect(mockConcert.estado).toBe(ConciertoEstado.CANCELADO);
    expect(mockConcert.canceladoEn).toBeDefined();
    expect(mockConcert.canceladoPorId).toBe(organizadorUserId);
  });

  it('rechaza la cancelación si el motivo no cumple con la longitud mínima', async () => {
    await expect(
      service.cancelarConcierto(
        organizadorUserId,
        concertId,
        { motivo: 'No' }, // Menos de 5 caracteres
        [RolNombre.ORGANIZADOR],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('deniega la cancelación si un organizador intenta cancelar un concierto ajeno', async () => {
    await expect(
      service.cancelarConcierto(
        otherOrganizerUserId,
        concertId,
        { motivo: 'Intento no autorizado' },
        [RolNombre.ORGANIZADOR],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('deniega la cancelación a un usuario con rol CLIENTE', async () => {
    await expect(
      service.cancelarConcierto(
        clientUserId,
        concertId,
        { motivo: 'Soy un cliente sin permiso' },
        [RolNombre.CLIENTE],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rechaza cancelar un concierto que está en BORRADOR (debe eliminarse o editarse)', async () => {
    mockConcert.estado = ConciertoEstado.BORRADOR;

    await expect(
      service.cancelarConcierto(
        organizadorUserId,
        concertId,
        { motivo: 'Evento aún no publicado' },
        [RolNombre.ORGANIZADOR],
      ),
    ).rejects.toThrow(/Solo se pueden cancelar conciertos que hayan sido publicados/i);
  });

  it('idempotencia: una segunda cancelación no duplica efectos y retorna confirmación', async () => {
    mockConcert.estado = ConciertoEstado.CANCELADO;
    mockConcert.motivoCancelacion = 'Cancelación previa';
    mockConcert.canceladoEn = new Date();

    const res = await service.cancelarConcierto(
      organizadorUserId,
      concertId,
      { motivo: 'Nuevo intento de cancelación' },
      [RolNombre.ORGANIZADOR],
    );

    expect(res.success).toBe(true);
    expect(res.yaCancelado).toBe(true);
    expect(res.mensaje).toMatch(/ya se encontraba cancelado/i);
  });

  it('permite a un ADMIN cancelar un concierto de cualquier organizador por fuerza mayor', async () => {
    const res = await service.cancelarConcierto(
      'admin-uuid-1',
      concertId,
      { motivo: 'Intervención de seguridad por el Administrador' },
      [RolNombre.ADMIN],
    );

    expect(res.success).toBe(true);
    expect(res.concierto.estado).toBe(ConciertoEstado.CANCELADO);
  });

  it('permite consultar la información de cancelación y el impacto en órdenes y tickets', async () => {
    mockConcert.estado = ConciertoEstado.CANCELADO;
    mockConcert.motivoCancelacion = 'Fuerza mayor comprobada';
    mockConcert.canceladoEn = new Date();

    const info = await service.obtenerInformacionCancelacion(
      organizadorUserId,
      concertId,
      [RolNombre.ORGANIZADOR],
    );

    expect(info.conciertoId).toBe(concertId);
    expect(info.estado).toBe(ConciertoEstado.CANCELADO);
    expect(info.motivoCancelacion).toBe('Fuerza mayor comprobada');
    expect(info.totalTicketsAfectados).toBe(15);
    expect(info.totalOrdenesAfectadas).toBe(2);
    expect(info.totalMontoAfectadoBob).toBe(500);
    expect(info.pagosPrueba).toBe(true);
  });

  it('mantiene accesible el detalle público de un concierto cancelado mediante enlace directo', async () => {
    mockConcert.estado = ConciertoEstado.CANCELADO;

    const detail = await service.getPublicConcertDetail(concertId);

    expect(detail).toBeDefined();
    expect(detail.id).toBe(concertId);
    expect(detail.estado).toBe(ConciertoEstado.CANCELADO);
    expect(detail.estadoVenta).toBe('VENTA_NO_INICIADA'); // Concierto no publicado -> venta no activa
  });
});
