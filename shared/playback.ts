import type { CatalogSong } from "./catalog";
export type RepeatMode = "none" | "all" | "one";
export function cycleRepeat(mode: RepeatMode): RepeatMode {
  return mode === "none" ? "all" : mode === "all" ? "one" : "none";
}
export function nextIndex(
  index: number,
  count: number,
  repeat: RepeatMode,
  ended = false,
) {
  if (count === 0) return -1;
  if (ended && repeat === "one") return index;
  if (index + 1 < count) return index + 1;
  return repeat === "all" ? 0 : -1;
}
export function shuffleSongs(
  songs: CatalogSong[],
  current: CatalogSong,
  random = Math.random,
) {
  const others = songs.filter((s) => s.id !== current.id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  return [current, ...others];
}
export function playbackTime(value: number) {
  if (!Number.isFinite(value) || value < 0) return "0:00";
  const n = Math.floor(value);
  return Math.floor(n / 60) + ":" + (n % 60).toString().padStart(2, "0");
}
export function publishedAudioUrl(base: string, id: string) {
  if (/^audius:[a-zA-Z0-9]+$/.test(id)) return base + "/auth/integrations/audius/tracks/" + encodeURIComponent(id) + "/audio";
  if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Canción inválida.");
  return base + "/auth/catalog/" + id + "/audio";
}
export type PublicArtist = {
  artist: {
    id: string;
    nombre: string;
    biografia: string;
    ciudad: string;
    pais: string;
    identidad: string[];
    avatarUrl: string | null;
    coverUrl: string | null;
  };
  songs: CatalogSong[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  latestRelease: {
    id: string;
    titulo: string;
    tipo: string;
    fecha: string | null;
    songCount: number;
  } | null;
  releases?: {
    id: string;
    titulo: string;
    tipo: string;
    fechaLanzamiento: string | null;
    coverUrl: string | null;
    songCount: number;
    duracionTotalSegundos: number;
    canciones: CatalogSong[];
  }[];
};
