import type { CatalogSong } from './catalog.js';

export type PlaylistSummary = {
  id: string;
  nombre: string;
  descripcion: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
  firstTrackId: string | null;
  firstTrackSource: 'LOCAL' | 'AUDIUS' | null;
};

export type PlaylistDetail = {
  id: string;
  nombre: string;
  descripcion: string;
  trackCount: number;
  createdAt: string;
  updatedAt: string;
  tracks: CatalogSong[];
};

export type FavoriteResponse = {
  favorited: boolean;
  trackId: string;
};
