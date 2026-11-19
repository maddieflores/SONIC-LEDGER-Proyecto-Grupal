import type { CatalogSong } from './catalog.js';

export type HistoryEventType = 'PLAYED' | 'SKIPPED';

export type ListeningHistoryItem = {
  id: string;
  trackId: string;
  source: 'LOCAL' | 'AUDIUS';
  eventType: HistoryEventType;
  listenedSeconds: number;
  trackDurationSeconds: number | null;
  startedAt: string;
  endedAt: string;
  createdAt: string;
  song: CatalogSong;
};

export type PaginatedHistory = {
  items: ListeningHistoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PlaybackEventPayload = {
  trackId: string;
  source?: 'LOCAL' | 'AUDIUS';
  listenedSeconds: number;
  trackDurationSeconds?: number | null;
  startedAt?: string;
  endedAt?: string;
  clientEventId?: string;
  eventType?: HistoryEventType;
};

export const PLAYBACK_THRESHOLD_SECONDS = 30;
export const SHORT_TRACK_THRESHOLD_RATIO = 0.5;

export function isValidPlayback(
  listenedSeconds: number,
  trackDurationSeconds?: number | null,
): boolean {
  if (listenedSeconds <= 0) return false;
  if (
    typeof trackDurationSeconds === 'number' &&
    trackDurationSeconds > 0 &&
    trackDurationSeconds < PLAYBACK_THRESHOLD_SECONDS
  ) {
    return listenedSeconds >= trackDurationSeconds * SHORT_TRACK_THRESHOLD_RATIO;
  }
  return listenedSeconds >= PLAYBACK_THRESHOLD_SECONDS;
}

// CU23 — Estadísticas Musicales
export type StatsPeriodo = '7d' | '30d' | 'all';

export type TopTrackStat = {
  trackId: string;
  source: 'LOCAL' | 'AUDIUS';
  titulo: string;
  artista: string;
  coverUrl: string | null;
  reproducciones: number;
  segundosEscuchados: number;
  minutosEscuchados: number;
};

export type TopArtistStat = {
  nombre: string;
  reproducciones: number;
  segundosEscuchados: number;
  minutosEscuchados: number;
};

export type TopGenreStat = {
  nombre: string;
  reproducciones: number;
  porcentaje: number;
};

export type DailyActivityStat = {
  fecha: string;
  diaSemana: string;
  reproducciones: number;
  minutosEscuchados: number;
};

export type MusicalStatsResponse = {
  periodo: StatsPeriodo;
  periodoLabel: string;
  totalReproduccionesValidas: number;
  segundosEscuchados: number;
  minutosEscuchados: number;
  horasEscuchadas: number;
  cancionesUnicas: number;
  artistasUnicos: number;
  generoMasEscuchado: string | null;
  topCanciones: TopTrackStat[];
  topArtistas: TopArtistStat[];
  topGeneros: TopGenreStat[];
  actividadDiaria: DailyActivityStat[];
  mensaje?: string;
};

