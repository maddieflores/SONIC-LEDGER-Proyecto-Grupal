import type { CatalogGenre } from './catalog';

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
  genero: CatalogGenre | null;
  duracionSegundos: number | null;
  coverUrl: string | null;
  score: number; // Afinidad de 0 a 100
  motivosRecomendacion: string[];
  playable: boolean;
}

export interface MusicRecommendationsResponse {
  items: RecommendedTrackItem[];
  total: number;
  esPersonalizada: boolean;
  criterioPrincipal?: string;
}

/**
 * Contrato de selección musical reutilizable para el futuro DJ (CU13 y CU14).
 * Acepta restricciones musicales y un conjunto de canciones candidatas,
 * garantizando devolver únicamente canciones existentes y válidas.
 */
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

/**
 * Interfaz desacoplada del motor de recomendación musical (CU12).
 * Permite reemplazar o conectar un motor externo en Python/FastAPI sin romper contratos.
 */
export interface IMusicRecommender {
  getRecommendations(
    userId: string,
    limit?: number,
  ): Promise<MusicRecommendationsResponse>;
}
