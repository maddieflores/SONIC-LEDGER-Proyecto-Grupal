/**
 * Identificador de fuente musical en Sonic Ledger.
 */
export type MusicSource = 'LOCAL' | 'AUDIUS';

/**
 * Representación normalizada de un artista para Sonic Ledger.
 */
export interface NormalizedArtist {
  id: string; // Formato unificado 'audius:<externalId>' para evitar colisiones
  source: MusicSource;
  externalId: string;
  name: string;
  handle: string;
  bio: string | null;
  profilePictureUrl: string | null;
  coverPhotoUrl: string | null;
  followerCount: number;
  isVerified: boolean;
  externalUrl: string;
}

/**
 * Representación normalizada de una pista musical para Sonic Ledger.
 */
export interface NormalizedTrack {
  id: string; // Formato unificado 'audius:<externalId>'
  source: MusicSource;
  externalId: string;
  title: string;
  artist: {
    id: string;
    externalId: string;
    name: string;
    handle: string;
    profilePictureUrl: string | null;
  };
  artworkUrl: string | null;
  durationSeconds: number | null;
  genre: string | null;
  mood: string | null;
  releaseDate: string | null;
  playCount: number;
  isPlayable: boolean;
  isStreamGated: boolean;
  externalUrl: string;
  streamUrl?: string | null;
}

/**
 * Información de disponibilidad y streaming de una pista.
 */
export interface StreamResolution {
  trackId: string;
  externalId: string;
  source: MusicSource;
  isPlayable: boolean;
  streamUrl: string | null;
  mirrors: string[];
  expiresAt?: string | null;
  attribution: {
    artistName: string;
    artistHandle: string;
    trackTitle: string;
    sourceName: 'Audius';
    platformUrl: string;
  };
}

/**
 * Respuesta paginada normalizada.
 */
export interface PaginatedResult<T> {
  data: T[];
  total?: number;
  limit: number;
  offset: number;
  source: MusicSource;
}

/**
 * Tipos de datos crudos retornados por la API pública de Audius v1.
 */
export interface AudiusArtwork {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
  mirrors?: string[];
}

export interface AudiusCoverPhoto {
  '640x'?: string;
  '2000x'?: string;
  mirrors?: string[];
}

export interface AudiusProfilePicture {
  '150x150'?: string;
  '480x480'?: string;
  '1000x1000'?: string;
  mirrors?: string[];
}

export interface AudiusUser {
  id: string;
  user_id?: number;
  name: string;
  handle: string;
  bio?: string | null;
  profile_picture?: AudiusProfilePicture | null;
  cover_photo?: AudiusCoverPhoto | null;
  follower_count?: number;
  is_verified?: boolean;
  location?: string | null;
}

export interface AudiusTrackStream {
  url?: string;
  mirrors?: string[];
}

export interface AudiusTrackAccess {
  stream?: boolean;
  download?: boolean;
}

export interface AudiusTrack {
  id: string;
  track_id?: number;
  title: string;
  description?: string | null;
  genre?: string | null;
  mood?: string | null;
  duration?: number;
  release_date?: string | null;
  created_at?: string | null;
  play_count?: number;
  favorite_count?: number;
  repost_count?: number;
  is_streamable?: boolean;
  is_stream_gated?: boolean;
  is_available?: boolean;
  is_delete?: boolean;
  permalink?: string | null;
  artwork?: AudiusArtwork | null;
  user_id?: string;
  user?: AudiusUser | null;
  access?: AudiusTrackAccess | null;
  stream?: AudiusTrackStream | null;
}

export interface AudiusApiResponse<T> {
  data: T;
  latest_chain_block?: number;
  latest_indexed_block?: number;
  signature?: string;
  timestamp?: string;
  version?: string;
}
