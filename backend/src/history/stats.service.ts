import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ListeningHistory } from './listening-history.entity.js';
import { LibraryService } from '../library/library.service.js';

export type StatsPeriodo = '7d' | '30d' | 'all';

export interface TopTrackStatDto {
  trackId: string;
  source: 'LOCAL' | 'AUDIUS';
  titulo: string;
  artista: string;
  coverUrl: string | null;
  reproducciones: number;
  segundosEscuchados: number;
  minutosEscuchados: number;
}

export interface TopArtistStatDto {
  nombre: string;
  reproducciones: number;
  segundosEscuchados: number;
  minutosEscuchados: number;
}

export interface TopGenreStatDto {
  nombre: string;
  reproducciones: number;
  porcentaje: number;
}

export interface DailyActivityStatDto {
  fecha: string;
  diaSemana: string;
  reproducciones: number;
  minutosEscuchados: number;
}

export interface MusicalStatsResponseDto {
  periodo: StatsPeriodo;
  periodoLabel: string;
  totalReproduccionesValidas: number;
  segundosEscuchados: number;
  minutosEscuchados: number;
  horasEscuchadas: number;
  cancionesUnicas: number;
  artistasUnicos: number;
  generoMasEscuchado: string | null;
  topCanciones: TopTrackStatDto[];
  topArtistas: TopArtistStatDto[];
  topGeneros: TopGenreStatDto[];
  actividadDiaria: DailyActivityStatDto[];
  mensaje?: string;
}

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/**
 * Servicio de Estadísticas Musicales Personales (CU23).
 * Agrega y analiza el historial de reproducción real (PLAYED) del usuario autenticado.
 */
@Injectable()
export class MusicalStatsService {
  private readonly logger = new Logger(MusicalStatsService.name);

  constructor(
    @InjectRepository(ListeningHistory)
    private readonly historyRepo: Repository<ListeningHistory>,
    private readonly libraryService: LibraryService,
  ) {}

  async getUserMusicalStats(
    userId: string,
    periodo: StatsPeriodo = '30d',
  ): Promise<MusicalStatsResponseDto> {
    const validPeriodo: StatsPeriodo =
      periodo === '7d' || periodo === 'all' ? periodo : '30d';

    const periodoLabel =
      validPeriodo === '7d'
        ? 'Últimos 7 días'
        : validPeriodo === 'all'
        ? 'Todo el historial'
        : 'Últimos 30 días';

    const now = new Date();
    let fechaDesde: Date | null = null;
    let diasEsperados = 30;

    if (validPeriodo === '7d') {
      fechaDesde = new Date(now.getTime() - 7 * 86400000);
      diasEsperados = 7;
    } else if (validPeriodo === '30d') {
      fechaDesde = new Date(now.getTime() - 30 * 86400000);
      diasEsperados = 30;
    } else {
      diasEsperados = 30; // Para el gráfico de todo el historial mostramos hasta los últimos 30 días con actividad
    }

    // 1. Consulta base de eventos PLAYED válidos
    const qb = this.historyRepo
      .createQueryBuilder('h')
      .where('h.usuario_id = :userId', { userId })
      .andWhere('h.event_type = :eventType', { eventType: 'PLAYED' })
      .andWhere('h.listened_seconds > 0');

    if (fechaDesde) {
      qb.andWhere('h.createdAt >= :fechaDesde', { fechaDesde });
    }

    // Traer todos los eventos del periodo para agregación exacta
    const entries = await qb
      .orderBy('h.createdAt', 'DESC')
      .getMany();

    // Estado vacío (Cold Start o sin reproducciones en el periodo)
    if (entries.length === 0) {
      return {
        periodo: validPeriodo,
        periodoLabel,
        totalReproduccionesValidas: 0,
        segundosEscuchados: 0,
        minutosEscuchados: 0,
        horasEscuchadas: 0,
        cancionesUnicas: 0,
        artistasUnicos: 0,
        generoMasEscuchado: null,
        topCanciones: [],
        topArtistas: [],
        topGeneros: [],
        actividadDiaria: this.generateEmptyDays(diasEsperados, now),
        mensaje:
          'Aún no tienes actividad registrada en este periodo. ¡Escucha canciones en Sonic Ledger para generar tus estadísticas!',
      };
    }

    // 2. Métricas globales
    const totalReproduccionesValidas = entries.length;
    let totalSegundos = 0;
    const trackCounts = new Map<string, { count: number; seconds: number; source: 'LOCAL' | 'AUDIUS' }>();
    const dailyMap = new Map<string, { plays: number; seconds: number }>();

    for (const e of entries) {
      totalSegundos += e.listenedSeconds;

      // Conteo por canción
      const existingTrack = trackCounts.get(e.trackId);
      if (existingTrack) {
        existingTrack.count += 1;
        existingTrack.seconds += e.listenedSeconds;
      } else {
        trackCounts.set(e.trackId, {
          count: 1,
          seconds: e.listenedSeconds,
          source: e.source,
        });
      }

      // Agrupación por día (YYYY-MM-DD en fecha local / UTC)
      const dayStr = e.createdAt.toISOString().slice(0, 10);
      const existingDay = dailyMap.get(dayStr);
      if (existingDay) {
        existingDay.plays += 1;
        existingDay.seconds += e.listenedSeconds;
      } else {
        dailyMap.set(dayStr, {
          plays: 1,
          seconds: e.listenedSeconds,
        });
      }
    }

    const segundosEscuchados = Math.round(totalSegundos * 10) / 10;
    const minutosEscuchados = Math.round(segundosEscuchados / 60);
    const horasEscuchadas = Math.round((segundosEscuchados / 3600) * 10) / 10;
    const cancionesUnicas = trackCounts.size;

    // 3. Resolver metadatos de las canciones escuchadas
    const allTrackRefs = Array.from(trackCounts.entries()).map(([trackId, data]) => ({
      trackId,
      source: data.source,
    }));

    const resolvedTracks = await this.libraryService.resolveTracks(allTrackRefs);
    const trackMap = new Map(resolvedTracks.map((t) => [t.id, t]));

    // 4. Top 5 Canciones
    const sortedTracks = Array.from(trackCounts.entries())
      .sort((a, b) => {
        if (b[1].count !== a[1].count) return b[1].count - a[1].count;
        return b[1].seconds - a[1].seconds;
      })
      .slice(0, 5);

    const topCanciones: TopTrackStatDto[] = sortedTracks.map(([trackId, data]) => {
      const resolved = trackMap.get(trackId);
      return {
        trackId,
        source: data.source,
        titulo: resolved?.titulo || 'Canción de Sonic Ledger',
        artista: resolved?.artista?.nombre || 'Artista Desconocido',
        coverUrl: resolved?.coverUrl || null,
        reproducciones: data.count,
        segundosEscuchados: Math.round(data.seconds * 10) / 10,
        minutosEscuchados: Math.round(data.seconds / 60),
      };
    });

    // 5. Top 5 Artistas & Artistas Únicos
    const artistMap = new Map<string, { plays: number; seconds: number }>();
    for (const [trackId, data] of trackCounts.entries()) {
      const resolved = trackMap.get(trackId);
      const artistName = resolved?.artista?.nombre || 'Artista Desconocido';
      const existing = artistMap.get(artistName);
      if (existing) {
        existing.plays += data.count;
        existing.seconds += data.seconds;
      } else {
        artistMap.set(artistName, { plays: data.count, seconds: data.seconds });
      }
    }

    const artistasUnicos = artistMap.size;
    const topArtistas: TopArtistStatDto[] = Array.from(artistMap.entries())
      .sort((a, b) => {
        if (b[1].plays !== a[1].plays) return b[1].plays - a[1].plays;
        return b[1].seconds - a[1].seconds;
      })
      .slice(0, 5)
      .map(([nombre, data]) => ({
        nombre,
        reproducciones: data.plays,
        segundosEscuchados: Math.round(data.seconds * 10) / 10,
        minutosEscuchados: Math.round(data.seconds / 60),
      }));

    // 6. Top 5 Géneros
    const genreMap = new Map<string, number>();
    let totalPlaysWithGenre = 0;

    for (const [trackId, data] of trackCounts.entries()) {
      const resolved = trackMap.get(trackId);
      if (resolved?.genero?.nombre) {
        const gName = resolved.genero.nombre.trim();
        genreMap.set(gName, (genreMap.get(gName) || 0) + data.count);
        totalPlaysWithGenre += data.count;
      }
    }

    const sortedGenres = Array.from(genreMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const generoMasEscuchado = sortedGenres.length > 0 ? sortedGenres[0][0] : null;

    const topGeneros: TopGenreStatDto[] = sortedGenres.slice(0, 5).map(([nombre, count]) => ({
      nombre,
      reproducciones: count,
      porcentaje:
        totalPlaysWithGenre > 0
          ? Math.round((count / totalPlaysWithGenre) * 100)
          : 0,
    }));

    // 7. Actividad Diaria Continua (Zero-filled para gráfica consistente)
    const actividadDiaria: DailyActivityStatDto[] = [];
    const daysToGenerate = validPeriodo === '7d' ? 7 : 30;

    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      const dayStr = d.toISOString().slice(0, 10);
      const dayOfWeek = DIAS_SEMANA[d.getDay()];
      const dayData = dailyMap.get(dayStr);

      actividadDiaria.push({
        fecha: dayStr,
        diaSemana: dayOfWeek,
        reproducciones: dayData ? dayData.plays : 0,
        minutosEscuchados: dayData ? Math.round(dayData.seconds / 60) : 0,
      });
    }

    return {
      periodo: validPeriodo,
      periodoLabel,
      totalReproduccionesValidas,
      segundosEscuchados,
      minutosEscuchados,
      horasEscuchadas,
      cancionesUnicas,
      artistasUnicos,
      generoMasEscuchado,
      topCanciones,
      topArtistas,
      topGeneros,
      actividadDiaria,
    };
  }

  private generateEmptyDays(daysCount: number, now: Date): DailyActivityStatDto[] {
    const res: DailyActivityStatDto[] = [];
    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      res.push({
        fecha: d.toISOString().slice(0, 10),
        diaSemana: DIAS_SEMANA[d.getDay()],
        reproducciones: 0,
        minutosEscuchados: 0,
      });
    }
    return res;
  }
}
