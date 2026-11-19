export type TrackSource = 'LOCAL' | 'AUDIUS';

export interface CandidateTrack {
  id: string;
  source: TrackSource;
  titulo: string;
  artistaId?: string;
  artistaNombre: string;
  generoId?: string | null;
  generoNombre?: string | null;
  duracionSegundos?: number | null;
  coverUrl?: string | null;
  playable: boolean;
}

export interface RecommendedTrackItem {
  id: string;
  source: TrackSource;
  titulo: string;
  artista: { id?: string; nombre: string };
  genero: { id?: string; nombre: string } | null;
  duracionSegundos: number | null;
  coverUrl: string | null;
  score: number;
  motivosRecomendacion: string[];
  playable: boolean;
}

export interface MusicRecommendationsResponse {
  items: RecommendedTrackItem[];
  total: number;
  esPersonalizada: boolean;
  criterioPrincipal?: string;
}

export interface TrackSelectorConstraints {
  generos?: string[];
  artistasExcluidos?: string[];
  cancionesExcluidas?: string[];
  duracionMinimaSegundos?: number;
  duracionMaximaSegundos?: number;
  soloPlayable?: boolean;
  maxPorArtista?: number;
  limite?: number;
}

export interface ITrackSelector {
  selectTracks(
    candidates: CandidateTrack[],
    constraints: TrackSelectorConstraints,
  ): CandidateTrack[];
}

export interface IMusicRecommender {
  getRecommendations(
    userId: string,
    limit?: number,
  ): Promise<MusicRecommendationsResponse>;
}

export const RECOMMENDATION_WEIGHTS = {
  GENERO_PREFERIDO: 30,
  CANCION_FAVORITA: 25,
  ARTISTA_FAVORITO: 20,
  ARTISTA_HISTORIAL: 15,
  GENERO_HISTORIAL: 10,
  HISTORIAL_FRECUENTE: 10,
  TIEMPO_ESCUCHADO: 10,
  PENALIZACION_SKIPPED_CANCION: 30,
  PENALIZACION_SKIPPED_ARTISTA: 15,
  MAX_POR_ARTISTA_DEFAULT: 2,
  LIMITE_DEFAULT: 10,
} as const;
