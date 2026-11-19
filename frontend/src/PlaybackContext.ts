import { createContext, useContext } from "react";
import type { CatalogSong } from "../../shared/catalog";
import type { RepeatMode } from "../../shared/playback";
export type PlaybackState = {
  song: CatalogSong | null;
  queue: CatalogSong[];
  index: number;
  playing: boolean;
  loading: boolean;
  position: number;
  duration: number;
  error: string;
  repeat: RepeatMode;
  shuffle: boolean;
  volume: number;
  play: (song: CatalogSong, queue?: CatalogSong[]) => void;
  toggle: () => void;
  seek: (value: number) => void;
  next: () => void;
  previous: () => void;
  setRepeat: () => void;
  setShuffle: () => void;
  setVolume: (value: number) => void;
  stop: () => void;
};
export const PlaybackContext = createContext<PlaybackState | null>(null);
export function usePlayback() {
  const p = useContext(PlaybackContext);
  if (!p) throw new Error("Falta PlayerProvider.");
  return p;
}
