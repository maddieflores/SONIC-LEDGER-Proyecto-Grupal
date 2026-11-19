import type { CatalogSong } from './catalog';
export type DjIntent = {
  genres: string[] | null;
  excludedGenres: string[] | null;
  removeExcludedGenres: string[] | null;
  activity: string | null;
  mood: 'calm' | 'energetic' | 'none' | null;
  intensityChange?: 'lower' | 'higher' | null;
  favorites: boolean | null;
  count: number | null;
  action: 'select' | 'add' | 'replace' | 'deduplicate';
  unsupported: string[];
};
export type DjConstraints = Omit<DjIntent, 'action' | 'unsupported' | 'removeExcludedGenres' | 'intensityChange'>;
export type DjSession = {
  id: string;
  version: number;
  constraints: DjConstraints;
  tracks: CatalogSong[];
  warnings: string[];
  playlistId: string | null;
};
export const emptyConstraints: DjConstraints = { genres: [], excludedGenres: [], activity: null, mood: 'none', favorites: false, count: 10 };



