import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { Concierto, ConciertoEstado } from './concierto.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { FavoriteTrack } from '../library/favorite-track.entity.js';
import { ListeningHistory } from '../history/listening-history.entity.js';
import { LibraryService } from '../library/library.service.js';
import { Genero } from '../musica/genero.entity.js';
import { computeSalesStatus } from './conciertos.service.js';

export interface RecommendedConcertDto {
  id: string;
  organizadorId: string;
  organizadorNombre?: string;
  titulo: string;
  descripcion: string;
  portadaUrl: string | null;
  genero: string;
  fechaInicio: string;
  fechaFin: string;
  zonaHoraria: string;
  recinto: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  estado: string;
  inicioVenta: string | null;
  destacado: boolean;
  estadoVenta: string;
  precioMinimo: number | null;
  motivoCancelacion?: string | null;
  canceladoEn?: string | null;
  artistas: Array<{
    id: string;
    conciertoId: string;
    artistaId: string | null;
    nombreArtista: string;
    orden: number;
    avatarUrl?: string | null;
  }>;
  categorias: Array<{
    id: string;
    conciertoId: string;
    nombre: string;
    precio: number;
    moneda: string;
    cupoTotal: number;
    cupoDisponible: number;
    disponible: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
  score: number;
  motivosRecomendacion: string[];
  esPersonalizada: boolean;
}

export interface RecommendationSignals {
  coincidenciaArtistas: boolean;
  coincidenciaGeneros: boolean;
  afinidadHistorial: boolean;
  coincidenciaCiudad: boolean;
  proximidadDias: number;
}

export interface IConcertRecommender {
  getRecommendations(
    userId: string,
    limit?: number,
    ciudadFiltro?: string,
  ): Promise<{
    items: RecommendedConcertDto[];
    total: number;
    esPersonalizada: boolean;
  }>;
}

/**
 * Servicio de Recomendaciones de Conciertos basado en Contenido y Afinidad (CU19).
 * Diseñado con una interfaz extensible IConcertRecommender para permitir
 * la integración futura con el microservicio de IA local de Python (Sprint 2).
 */
@Injectable()
export class RecomendacionesService implements IConcertRecommender {
  private readonly logger = new Logger(RecomendacionesService.name);

  // Pesos transparentes del algoritmo
  public static readonly PESO_ARTISTAS = 35;
  public static readonly PESO_GENEROS = 30;
  public static readonly PESO_HISTORIAL_FRECUENTE = 20;
  public static readonly PESO_CIUDAD = 15;
  public static readonly MAX_BONUS_PROXIMIDAD = 10;

  constructor(
    @InjectRepository(Concierto)
    private readonly conciertosRepo: Repository<Concierto>,
    @InjectRepository(Usuario)
    private readonly usuariosRepo: Repository<Usuario>,
    @InjectRepository(FavoriteTrack)
    private readonly favoritesRepo: Repository<FavoriteTrack>,
    @InjectRepository(ListeningHistory)
    private readonly historyRepo: Repository<ListeningHistory>,
    @InjectRepository(Genero)
    private readonly generosRepo: Repository<Genero>,
    private readonly libraryService: LibraryService,
  ) {}

  /**
   * Genera recomendaciones de conciertos para un usuario autenticado.
   */
  async getRecommendations(
    userId: string,
    limit = 6,
    ciudadFiltro?: string,
  ): Promise<{
    items: RecommendedConcertDto[];
    total: number;
    esPersonalizada: boolean;
  }> {
    const maxResults = Math.min(20, Math.max(1, limit || 6));
    const now = new Date();

    // 1. Obtener conciertos elegibles (PUBLICADO, no cancelado, fechaFin >= now)
    const eligibleConcerts = await this.conciertosRepo.find({
      where: {
        estado: ConciertoEstado.PUBLICADO,
        fechaFin: MoreThanOrEqual(now),
      },
      relations: {
        artistas: {
          artista: true,
        },
        categorias: true,
        organizador: true,
      },
      order: {
        fechaInicio: 'ASC',
      },
    });

    if (eligibleConcerts.length === 0) {
      return {
        items: [],
        total: 0,
        esPersonalizada: false,
      };
    }

    // 2. Extraer señales del usuario (perfil, favoritos, historial válido)
    const [user, favorites, historyEntries] = await Promise.all([
      this.usuariosRepo.findOne({ where: { id: userId } }),
      this.favoritesRepo.find({
        where: { usuarioId: userId },
        take: 50,
      }),
      this.historyRepo.find({
        where: {
          usuarioId: userId,
          eventType: 'PLAYED',
        },
        order: { createdAt: 'DESC' },
        take: 100,
      }),
    ]);

    // Resolver géneros preferidos explícitos
    const preferredGenres = new Set<string>();
    if (user?.musicPreferences?.genreIds && Array.isArray(user.musicPreferences.genreIds)) {
      for (const gid of user.musicPreferences.genreIds) {
        if (typeof gid === 'string' && gid.trim()) {
          preferredGenres.add(gid.trim().toLowerCase());
        }
      }
    }

    // Si los IDs son UUIDs, buscar sus nombres en la base de datos
    if (preferredGenres.size > 0) {
      const allGeneros = await this.generosRepo.find();
      for (const g of allGeneros) {
        if (preferredGenres.has(g.id.toLowerCase())) {
          preferredGenres.add(g.nombre.toLowerCase());
        }
      }
    }

    // Resolver metadatos de pistas favoritas e historial (LOCAL y AUDIUS)
    const trackRefsToResolve: Array<{ trackId: string; source: 'LOCAL' | 'AUDIUS' }> = [];
    const seenTrackIds = new Set<string>();

    for (const f of favorites) {
      if (!seenTrackIds.has(f.trackId)) {
        seenTrackIds.add(f.trackId);
        trackRefsToResolve.push({ trackId: f.trackId, source: f.source });
      }
    }

    for (const h of historyEntries) {
      if (!seenTrackIds.has(h.trackId) && h.listenedSeconds >= 30) {
        seenTrackIds.add(h.trackId);
        trackRefsToResolve.push({ trackId: h.trackId, source: h.source });
      }
    }

    const resolvedTracks =
      trackRefsToResolve.length > 0
        ? await this.libraryService.resolveTracks(trackRefsToResolve)
        : [];

    // Construir índices de artistas y géneros escuchados
    const artistPlayCounts = new Map<string, number>();
    const genrePlayCounts = new Map<string, number>();

    // Artistas de favoritos (peso base 2)
    for (const f of favorites) {
      const resolved = resolvedTracks.find((t) => t.id === f.trackId);
      if (resolved && resolved.artista?.nombre) {
        const aNorm = resolved.artista.nombre.toLowerCase().trim();
        artistPlayCounts.set(aNorm, (artistPlayCounts.get(aNorm) || 0) + 2);
      }
      if (resolved && resolved.genero?.nombre) {
        const gNorm = resolved.genero.nombre.toLowerCase().trim();
        genrePlayCounts.set(gNorm, (genrePlayCounts.get(gNorm) || 0) + 2);
      }
    }

    // Artistas de historial PLAYED
    for (const h of historyEntries) {
      if (h.listenedSeconds < 30) continue; // Descartar omisiones
      const resolved = resolvedTracks.find((t) => t.id === h.trackId);
      if (resolved && resolved.artista?.nombre) {
        const aNorm = resolved.artista.nombre.toLowerCase().trim();
        artistPlayCounts.set(aNorm, (artistPlayCounts.get(aNorm) || 0) + 1);
      }
      if (resolved && resolved.genero?.nombre) {
        const gNorm = resolved.genero.nombre.toLowerCase().trim();
        genrePlayCounts.set(gNorm, (genrePlayCounts.get(gNorm) || 0) + 1);
        preferredGenres.add(gNorm);
      }
    }

    const hasSignals =
      preferredGenres.size > 0 ||
      artistPlayCounts.size > 0 ||
      (ciudadFiltro && ciudadFiltro.trim().length > 0);

    // 3. Evaluar cada concierto eligible contra las señales del usuario
    const scoredConcerts: Array<{
      concert: Concierto;
      score: number;
      reasons: string[];
    }> = [];

    for (const c of eligibleConcerts) {
      let score = 0;
      const reasons: string[] = [];

      const concertGenreNorm = (c.genero || '').toLowerCase().trim();
      const concertCityNorm = (c.ciudad || '').toLowerCase().trim();
      const filterCityNorm = (ciudadFiltro || '').toLowerCase().trim();

      // Señal 1: Coincidencia de Artistas (Peso 35)
      let matchedArtistName: string | null = null;
      for (const ca of c.artistas || []) {
        const aNorm = (ca.nombreArtista || '').toLowerCase().trim();
        if (artistPlayCounts.has(aNorm)) {
          matchedArtistName = ca.nombreArtista;
          break;
        }
      }

      if (matchedArtistName) {
        score += RecomendacionesService.PESO_ARTISTAS;
        reasons.push(`Participa ${matchedArtistName}, un artista que escuchas`);
      }

      // Señal 2: Coincidencia de Género (Peso 30)
      if (concertGenreNorm) {
        let genreMatched = false;
        if (preferredGenres.has(concertGenreNorm)) {
          genreMatched = true;
        } else {
          // Coincidencia parcial (e.g., "Rock" en "Hard Rock")
          for (const g of preferredGenres) {
            if (concertGenreNorm.includes(g) || g.includes(concertGenreNorm)) {
              genreMatched = true;
              break;
            }
          }
        }

        if (genreMatched) {
          score += RecomendacionesService.PESO_GENEROS;
          reasons.push(`Te puede interesar porque escuchas ${c.genero}`);
        }
      }

      // Señal 3: Afinidad con Historial Frecuente (Peso 20)
      const genreFrequency = genrePlayCounts.get(concertGenreNorm) || 0;
      let artistFrequency = 0;
      for (const ca of c.artistas || []) {
        const aNorm = (ca.nombreArtista || '').toLowerCase().trim();
        artistFrequency += artistPlayCounts.get(aNorm) || 0;
      }

      if (genreFrequency >= 3 || artistFrequency >= 3) {
        score += RecomendacionesService.PESO_HISTORIAL_FRECUENTE;
        reasons.push('Frecuente en tu historial de reproducción');
      }

      // Señal 4: Coincidencia de Ciudad (Peso 15)
      if (filterCityNorm && concertCityNorm.includes(filterCityNorm)) {
        score += RecomendacionesService.PESO_CIUDAD;
        reasons.push(`En tu ciudad seleccionada (${c.ciudad})`);
      }

      // Señal 5: Bonus de Proximidad Temporal (hasta 10 puntos)
      const diffMs = new Date(c.fechaInicio).getTime() - now.getTime();
      const diffDays = Math.max(0, Math.floor(diffMs / 86400000));
      if (diffDays <= 30) {
        const proximityBonus = Math.max(1, Math.min(RecomendacionesService.MAX_BONUS_PROXIMIDAD, 10 - Math.floor(diffDays / 3)));
        score += proximityBonus;
        if (diffDays <= 7 && reasons.length > 0) {
          reasons.push('¡Próximamente en vivo (esta semana)!');
        }
      }

      scoredConcerts.push({
        concert: c,
        score,
        reasons,
      });
    }

    // 4. Clasificar: si hay conciertos con score > 0 y señales reales, retornar personalizados
    const personalizedList = scoredConcerts.filter((sc) => sc.score > 0);

    let finalConcerts: Array<{
      concert: Concierto;
      score: number;
      reasons: string[];
      isPersonalized: boolean;
    }> = [];

    if (hasSignals && personalizedList.length > 0) {
      personalizedList.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return new Date(a.concert.fechaInicio).getTime() - new Date(b.concert.fechaInicio).getTime();
      });

      finalConcerts = personalizedList.slice(0, maxResults).map((sc) => ({
        concert: sc.concert,
        score: sc.score,
        reasons: sc.reasons.length > 0 ? sc.reasons : ['Recomendado para ti según tus gustos'],
        isPersonalized: true,
      }));
    } else {
      // Cold-start o sin señales coincidentes: descubrimiento de próximos conciertos
      eligibleConcerts.sort(
        (a, b) => new Date(a.fechaInicio).getTime() - new Date(b.fechaInicio).getTime(),
      );

      finalConcerts = eligibleConcerts.slice(0, maxResults).map((c) => ({
        concert: c,
        score: 0,
        reasons: ['Descubre los próximos eventos destacados en cartelera'],
        isPersonalized: false,
      }));
    }

    // 5. Mapear a DTO enriquecido
    const items: RecommendedConcertDto[] = finalConcerts.map((item) => {
      const c = item.concert;
      const categorias = (c.categorias || []).map((cat) => ({
        id: cat.id,
        conciertoId: cat.conciertoId,
        nombre: cat.nombre,
        precio: Number(cat.precio),
        moneda: cat.moneda,
        cupoTotal: cat.cupoTotal,
        cupoDisponible: cat.cupoDisponible,
        disponible: cat.disponible,
      }));

      const precios = categorias
        .filter((cat) => cat.disponible)
        .map((cat) => cat.precio);
      const precioMinimo = precios.length > 0 ? Math.min(...precios) : null;

      const estadoVenta = computeSalesStatus(
        c.estado,
        c.inicioVenta,
        c.fechaFin,
        now,
      );

      return {
        id: c.id,
        organizadorId: c.organizadorId,
        organizadorNombre: c.organizador?.displayName || c.organizador?.username || 'Organizador',
        titulo: c.titulo,
        descripcion: c.descripcion,
        portadaUrl: c.portadaUrl,
        genero: c.genero,
        fechaInicio: c.fechaInicio.toISOString(),
        fechaFin: c.fechaFin.toISOString(),
        zonaHoraria: c.zonaHoraria,
        recinto: c.recinto,
        direccion: c.direccion,
        ciudad: c.ciudad,
        departamento: c.departamento,
        estado: c.estado,
        inicioVenta: c.inicioVenta ? c.inicioVenta.toISOString() : null,
        destacado: c.destacado,
        estadoVenta,
        precioMinimo,
        motivoCancelacion: c.motivoCancelacion,
        canceladoEn: c.canceladoEn ? c.canceladoEn.toISOString() : null,
        artistas: (c.artistas || []).map((a) => ({
          id: a.id,
          conciertoId: a.conciertoId,
          artistaId: a.artistaId,
          nombreArtista: a.nombreArtista,
          orden: a.orden,
          avatarUrl: a.artista?.avatarUrl ?? null,
        })),
        categorias,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
        score: item.score,
        motivosRecomendacion: item.reasons,
        esPersonalizada: item.isPersonalized,
      };
    });

    const isGlobalPersonalized = items.some((i) => i.esPersonalizada);

    return {
      items,
      total: items.length,
      esPersonalizada: isGlobalPersonalized,
    };
  }
}
