import { ArtistApiError, artistRequest } from "../../shared/artist-api";
export { ArtistApiError as SongsApiError };
const base = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
export type SongState = "borrador" | "publicado";
export type SongInput = {
  titulo: string;
  descripcion: string;
  generoId: string | null;
  lanzamientoId: string | null;
};
export type Song = SongInput & {
  id: string;
  artista: string;
  genero: string | null;
  lanzamiento: string | null;
  estado: SongState;
  duracionSegundos: number | null;
  createdAt: string;
  updatedAt: string;
  audioUrl: string | null;
  coverUrl: string | null;
};
export type SongOptions = {
  artist: { nombreArtistico: string };
  genres: { id: string; nombre: string }[];
  releases: { id: string; titulo: string }[];
  uploadsEnabled: boolean;
};
export type Dashboard = {
  artist: { nombreArtistico: string };
  totals: {
    total: number;
    published: number;
    drafts: number;
    releases: number;
  };
  published: Song[];
  drafts: Song[];
  recentActivity: Song[];
};
export type SongList = {
  items: Song[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
const call = <T>(path: string, method = "GET", body?: unknown) =>
  artistRequest<T>(base, "artist-songs" + path, method, body);
export const songsApi = {
  dashboard: () => call<Dashboard>("/dashboard"),
  options: () => call<SongOptions>("/options"),
  list: (q: URLSearchParams) => call<SongList>("?" + q),
  get: (id: string) => call<Song>("/" + id),
  create: (data: SongInput) => call<Song>("", "POST", data),
  update: (id: string, data: SongInput) => call<Song>("/" + id, "PATCH", data),
  state: (id: string, estado: SongState) =>
    call<Song>("/" + id + "/state", "PATCH", { estado }),
};
export function songMediaUrl(reference: string | null) {
  if (
    !reference ||
    !/^\/api\/auth\/artist-songs\/[a-f0-9-]+\/media\/(audio|cover)\/[a-f0-9-]+\.(wav|png|jpg)$/.test(
      reference,
    )
  )
    return undefined;
  return base.replace(/\/api\/?$/, "") + reference;
}
export function uploadSongFile(
  id: string,
  kind: "audio" | "cover",
  file: File,
  progress: (percent: number) => void,
): Promise<Song> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", base + "/auth/artist-songs/" + id + "/" + kind);
    xhr.withCredentials = true;
    xhr.timeout = 120000;
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) progress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else
          reject(
            new ArtistApiError(
              Array.isArray(data.message)
                ? data.message.join(". ")
                : data.message || "No se pudo almacenar el archivo.",
              xhr.status,
            ),
          );
      } catch {
        reject(new Error("Respuesta inválida al cargar archivo."));
      }
    };
    xhr.onerror = () =>
      reject(
        new Error("No se pudo conectar al servidor para cargar el archivo."),
      );
    xhr.ontimeout = () =>
      reject(
        new Error(
          "La carga tardó demasiado. Comprueba la canción antes de reintentar.",
        ),
      );
    const body = new FormData();
    const upload = file.type
      ? file
      : new File([file], file.name, {
          type:
            kind === "audio"
              ? "audio/wav"
              : file.name.toLowerCase().endsWith(".png")
                ? "image/png"
                : "image/jpeg",
        });
    body.append("file", upload);
    xhr.send(body);
  });
}
export function songDuration(seconds: number | null) {
  if (seconds === null) return "—";
  return (
    Math.floor(seconds / 60)
      .toString()
      .padStart(2, "0") +
    ":" +
    (seconds % 60).toString().padStart(2, "0")
  );
}
