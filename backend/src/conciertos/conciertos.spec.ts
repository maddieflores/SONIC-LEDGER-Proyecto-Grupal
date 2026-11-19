import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  ConciertosService,
  computeSalesStatus,
} from './conciertos.service.js';
import {
  Concierto,
  ConciertoEstado,
  ConciertoEstadoVenta,
} from './concierto.entity.js';
import { ConciertoCategoria } from './concierto-categoria.entity.js';
import { ConciertoArtista } from './concierto-artista.entity.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Reflector } from '@nestjs/core';
import { RolNombre } from '../auth/rol.entity.js';

describe('CU15, CU16, CU18 — Conciertos y Venta de Entradas', () => {
  let service: ConciertosService;
  let mockConciertosRepo: any;
  let mockArtistasRepo: any;
  let mockCategoriasRepo: any;
  let mockPlatformArtistsRepo: any;
  let mockUsuariosRepo: any;

  const orgUserId1 = 'u0000000-0000-4000-8000-000000000001';
  const orgUserId2 = 'u0000000-0000-4000-8000-000000000002';
  const concertId = 'c0000000-0000-4000-8000-000000000001';

  let mockConcert: Concierto;

  beforeEach(() => {
    mockConcert = {
      id: concertId,
      organizadorId: orgUserId1,
      titulo: 'Illimani Metal Fest 2026',
      descripcion: 'El festival de rock y metal más potente del país.',
      portadaUrl: null,
      genero: 'Heavy Metal',
      fechaInicio: new Date(Date.now() + 86400000 * 30), // 30 días en el futuro
      fechaFin: new Date(Date.now() + 86400000 * 30 + 3600000 * 6), // 6 horas después
      zonaHoraria: 'America/La_Paz',
      recinto: 'Teatro al Aire Libre Jaime Laredo',
      direccion: 'Av. del Poeta s/n',
      ciudad: 'La Paz',
      departamento: 'La Paz',
      estado: ConciertoEstado.BORRADOR,
      inicioVenta: new Date(Date.now() - 3600000), // hace 1 hora
      destacado: true,
      artistas: [],
      categorias: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      organizador: {
        id: orgUserId1,
        username: 'organizador_demo',
        displayName: 'Producciones Altiplano',
      } as any,
    };

    mockConciertosRepo = {
      create: vi.fn((data) => ({
        ...data,
        id: concertId,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: vi.fn(async (entity) => ({
        ...entity,
        id: entity.id || concertId,
        createdAt: entity.createdAt || new Date(),
        updatedAt: new Date(),
      })),
      findOne: vi.fn(async ({ where }: any) => {
        if (where.id === concertId) {
          return { ...mockConcert };
        }
        return null;
      }),
      find: vi.fn(async () => [{ ...mockConcert }]),
      createQueryBuilder: vi.fn(() => {
        const qb: any = {
          leftJoinAndSelect: vi.fn().mockReturnThis(),
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          addOrderBy: vi.fn().mockReturnThis(),
          skip: vi.fn().mockReturnThis(),
          take: vi.fn().mockReturnThis(),
          getManyAndCount: vi.fn(async () => [
            mockConcert.estado === ConciertoEstado.PUBLICADO ? [mockConcert] : [],
            mockConcert.estado === ConciertoEstado.PUBLICADO ? 1 : 0,
          ]),
        };
        return qb;
      }),
    };

    mockArtistasRepo = {
      create: vi.fn((data) => ({ ...data, id: 'art-rel-1', createdAt: new Date() })),
      save: vi.fn(async (e) => e),
      findOne: vi.fn(async () => ({ id: 'art-rel-1', conciertoId: concertId })),
      remove: vi.fn(async () => {}),
    };

    mockCategoriasRepo = {
      create: vi.fn((data) => ({
        ...data,
        id: 'cat-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      save: vi.fn(async (e) => e),
      findOne: vi.fn(async () => ({
        id: 'cat-1',
        conciertoId: concertId,
        nombre: 'General',
        precio: 80,
        moneda: 'BOB',
        cupoTotal: 100,
        cupoDisponible: 100,
        disponible: true,
      })),
      remove: vi.fn(async () => {}),
    };

    mockPlatformArtistsRepo = {
      findOne: vi.fn(async () => ({
        id: 'pa-1',
        nombreArtistico: 'Aura Neón',
        avatarUrl: '/avatars/aura.webp',
      })),
      find: vi.fn(async () => [
        { id: 'pa-1', nombreArtistico: 'Aura Neón', avatarUrl: '/avatars/aura.webp' },
      ]),
    };

    mockUsuariosRepo = {
      findOne: vi.fn(async () => ({ id: orgUserId1, username: 'organizador_demo' })),
    };

    service = new ConciertosService(
      mockConciertosRepo,
      mockArtistasRepo,
      mockCategoriasRepo,
      mockPlatformArtistsRepo,
      mockUsuariosRepo,
      {} as any,
    );
  });

  describe('CU15 — Crear y configurar concierto', () => {
    it('permite a un organizador crear un concierto como borrador con datos válidos', async () => {
      const dto = {
        titulo: 'Festival Illimani 2026',
        descripcion: 'Festival en La Paz',
        genero: 'Rock',
        fechaInicio: new Date(Date.now() + 86400000 * 10).toISOString(),
        fechaFin: new Date(Date.now() + 86400000 * 10 + 3600000 * 5).toISOString(),
        recinto: 'Teatro al Aire Libre',
        direccion: 'Av. del Poeta',
        ciudad: 'La Paz',
        departamento: 'La Paz',
      };

      const result = await service.createDraft(orgUserId1, dto);

      expect(result).toBeDefined();
      expect(result.estado).toBe(ConciertoEstado.BORRADOR);
      expect(result.titulo).toBe('Festival Illimani 2026');
      expect(mockConciertosRepo.save).toHaveBeenCalled();
    });

    it('rechaza fechas incoherentes (fechaInicio >= fechaFin)', async () => {
      const dto = {
        titulo: 'Concierto Inválido',
        fechaInicio: new Date(Date.now() + 86400000 * 10).toISOString(),
        fechaFin: new Date(Date.now() + 86400000 * 9).toISOString(), // Anterior al inicio
        recinto: 'Recinto X',
        direccion: 'Calle 1',
        ciudad: 'Cochabamba',
        departamento: 'Cochabamba',
      };

      await expect(service.createDraft(orgUserId1, dto)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('rechaza edición de un concierto por otro organizador ajeno', async () => {
      await expect(
        service.updateConcert(orgUserId2, concertId, {
          titulo: 'Intento de hackeo de concierto',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('permite agregar categorías de entrada con precio en BOB y cupo positivo', async () => {
      const catDto = {
        nombre: 'VIP Experiencia',
        precio: 250,
        moneda: 'BOB',
        cupoTotal: 50,
      };

      const cat = await service.addCategory(orgUserId1, concertId, catDto);
      expect(cat.nombre).toBe('VIP Experiencia');
      expect(cat.precio).toBe(250);
      expect(cat.moneda).toBe('BOB');
      expect(cat.cupoTotal).toBe(50);
      expect(cat.cupoDisponible).toBe(50);
    });

    it('rechaza categorías con precio negativo o cupo menor a 1', async () => {
      await expect(
        service.addCategory(orgUserId1, concertId, {
          nombre: 'Inválida',
          precio: -10,
          cupoTotal: 100,
        }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.addCategory(orgUserId1, concertId, {
          nombre: 'Sin cupo',
          precio: 50,
          cupoTotal: 0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rechaza nombres de categoría duplicados en el mismo concierto', async () => {
      mockConcert.categorias = [
        {
          id: 'cat-existente',
          conciertoId: concertId,
          nombre: 'General',
          precio: 70,
          moneda: 'BOB',
          cupoTotal: 100,
          cupoDisponible: 100,
          disponible: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ];

      await expect(
        service.addCategory(orgUserId1, concertId, {
          nombre: 'GENERAL', // Caso insensible
          precio: 80,
          cupoTotal: 50,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('CU16 — Publicar concierto e inicio de venta', () => {
    it('rechaza publicar si no tiene portada', async () => {
      mockConcert.portadaUrl = null;
      mockConcert.categorias = [
        {
          id: 'cat-1',
          conciertoId: concertId,
          nombre: 'General',
          precio: 50,
          moneda: 'BOB',
          cupoTotal: 100,
          cupoDisponible: 100,
          disponible: true,
        } as any,
      ];

      await expect(service.publish(orgUserId1, concertId)).rejects.toThrow(
        /portada/i,
      );
    });

    it('rechaza publicar si no tiene al menos una categoría de entradas', async () => {
      mockConcert.portadaUrl = '/api/conciertos/c1/cover/portada.png';
      mockConcert.categorias = [];

      await expect(service.publish(orgUserId1, concertId)).rejects.toThrow(
        /categoría de entradas/i,
      );
    });

    it('rechaza publicar si la fecha ya pasó', async () => {
      mockConcert.portadaUrl = '/api/conciertos/c1/cover/portada.png';
      mockConcert.fechaInicio = new Date(Date.now() - 86400000 * 2);
      mockConcert.fechaFin = new Date(Date.now() - 86400000);
      mockConcert.categorias = [
        {
          id: 'cat-1',
          conciertoId: concertId,
          nombre: 'General',
          precio: 50,
          moneda: 'BOB',
          cupoTotal: 100,
          cupoDisponible: 100,
          disponible: true,
        } as any,
      ];

      await expect(service.publish(orgUserId1, concertId)).rejects.toThrow(
        /fecha ya ha pasado/i,
      );
    });

    it('publica un concierto configurado correctamente y calcula estadoVenta', async () => {
      mockConcert.portadaUrl = '/api/conciertos/c1/cover/portada.png';
      mockConcert.categorias = [
        {
          id: 'cat-1',
          conciertoId: concertId,
          nombre: 'General',
          precio: 50,
          moneda: 'BOB',
          cupoTotal: 100,
          cupoDisponible: 100,
          disponible: true,
        } as any,
      ];

      const published = await service.publish(orgUserId1, concertId);
      expect(published.estado).toBe(ConciertoEstado.PUBLICADO);
      expect(published.estadoVenta).toBe(ConciertoEstadoVenta.VENTA_INICIADA);
      expect(published.precioMinimo).toBe(50);
    });

    it('calcula VENTA_PENDIENTE si inicioVenta es futuro', () => {
      const futuro = new Date(Date.now() + 86400000 * 5);
      const fin = new Date(Date.now() + 86400000 * 10);
      const status = computeSalesStatus(ConciertoEstado.PUBLICADO, futuro, fin);
      expect(status).toBe(ConciertoEstadoVenta.VENTA_PENDIENTE);
    });

    it('calcula VENTA_CERRADA si la fecha fin ya pasó', () => {
      const inicioVenta = new Date(Date.now() - 86400000 * 5);
      const finPasada = new Date(Date.now() - 3600000);
      const status = computeSalesStatus(ConciertoEstado.PUBLICADO, inicioVenta, finPasada);
      expect(status).toBe(ConciertoEstadoVenta.VENTA_CERRADA);
    });
  });

  describe('CU18 — Buscar y consultar conciertos', () => {
    it('oculta conciertos en borrador del catálogo público', async () => {
      mockConcert.estado = ConciertoEstado.BORRADOR;

      const result = await service.findPublicConcerts({});
      expect(result.items.length).toBe(0);
      expect(result.total).toBe(0);
    });

    it('permite a visitantes consultar concierto publicado sin iniciar sesión', async () => {
      mockConcert.estado = ConciertoEstado.PUBLICADO;
      mockConcert.portadaUrl = '/api/conciertos/c1/cover.jpg';
      mockConcert.categorias = [
        {
          id: 'cat-1',
          conciertoId: concertId,
          nombre: 'General',
          precio: 60,
          moneda: 'BOB',
          cupoTotal: 200,
          cupoDisponible: 200,
          disponible: true,
        } as any,
      ];

      // Llamada sin pasar objeto user (visitante anónimo)
      const detail = await service.getPublicConcertDetail(concertId, undefined);
      expect(detail).toBeDefined();
      expect(detail.titulo).toBe('Illimani Metal Fest 2026');
      expect(detail.categorias[0].precio).toBe(60);
      // No debe exponer datos privados del usuario organizador
      expect((detail as any).organizador?.passwordHash).toBeUndefined();
    });

    it('deniega acceso público al detalle de un borrador a visitantes', async () => {
      mockConcert.estado = ConciertoEstado.BORRADOR;

      await expect(
        service.getPublicConcertDetail(concertId, undefined),
      ).rejects.toThrow(NotFoundException);
    });

    it('permite al organizador propietario ver el detalle de su propio borrador', async () => {
      mockConcert.estado = ConciertoEstado.BORRADOR;

      const detail = await service.getPublicConcertDetail(concertId, {
        id: orgUserId1,
        roles: [RolNombre.ORGANIZADOR],
      });
      expect(detail).toBeDefined();
      expect(detail.id).toBe(concertId);
    });
  });

  describe('Control de acceso RBAC — RolesGuard', () => {
    it('rechaza la creación de conciertos para un usuario con solo rol CLIENTE', () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RolNombre.ORGANIZADOR]);

      const guard = new RolesGuard(reflector);

      const mockExecutionContext: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn(() => ({
          getRequest: vi.fn(() => ({
            user: {
              id: 'client-1',
              roles: [RolNombre.CLIENTE],
            },
          })),
        })),
      };

      expect(() => guard.canActivate(mockExecutionContext)).toThrow(
        ForbiddenException,
      );
    });

    it('permite el acceso a un usuario con rol ORGANIZADOR', () => {
      const reflector = new Reflector();
      vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue([RolNombre.ORGANIZADOR]);

      const guard = new RolesGuard(reflector);

      const mockExecutionContext: any = {
        getHandler: vi.fn(),
        getClass: vi.fn(),
        switchToHttp: vi.fn(() => ({
          getRequest: vi.fn(() => ({
            user: {
              id: orgUserId1,
              roles: [RolNombre.CLIENTE, RolNombre.ORGANIZADOR],
            },
          })),
        })),
      };

      expect(guard.canActivate(mockExecutionContext)).toBe(true);
    });
  });
});
