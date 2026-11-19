import { resolveApiBase, resolveAuthToken } from "./api-config.js";

export type CatalogGenre = { id: string; nombre: string };
export type CatalogSong = {
  source?: "LOCAL" | "AUDIUS";
  id: string;
  titulo: string;
  artista: { id: string; nombre: string };
  genero: CatalogGenre | null;
  duracionSegundos: number | null;
  descripcion: string;
  coverUrl: string | null;
  playable?: boolean;
};
export type CatalogPage = {
  externalError?: string;
  items: CatalogSong[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
export type CatalogDetail = { song: CatalogSong; moreByArtist: CatalogSong[] };
export class CatalogError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function catalogRequest<T>(
  base: string,
  path: string,
  token?: string,
  signal?: AbortSignal,
): Promise<T> {
  const cleanBase = resolveApiBase(base);
  const activeToken = resolveAuthToken(token);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  if (signal?.aborted) controller.abort();
  try {
    if (path.startsWith("/audius:")) {
      const track = await audiusRequest(cleanBase, "/tracks/" + encodeURIComponent(path.slice(1)), activeToken, signal);
      const related = await audiusRequest(cleanBase, "/artists/" + encodeURIComponent(track.artist.id) + "/tracks?limit=12", activeToken, signal).catch(() => ({data: []}));
      return {song: externalSong(track), moreByArtist: related.data.filter((t: AudiusTrack) => t.id !== track.id).map(externalSong)} as T;
    }
    if (path.startsWith("/artists/audius:")) {
      const id = path.split("/")[2].split("?")[0];
      const a = await audiusRequest(cleanBase, "/artists/" + encodeURIComponent(id), activeToken, signal);
      const tracks = await audiusRequest(cleanBase, "/artists/" + encodeURIComponent(id) + "/tracks?limit=50", activeToken, signal);
      return {artist: {id:a.id, nombre:a.name, biografia:a.bio || "", ciudad:"", pais:"", identidad:[], avatarUrl:null, coverUrl:null},songs:tracks.data.map(externalSong),total:tracks.data.length,page:1,pageSize:50,totalPages:1,latestRelease:null} as T;
    }
    const r = await fetch(cleanBase + "/auth/catalog" + path, {
      credentials: "include",
      headers: activeToken ? { Authorization: "Bearer " + activeToken } : {},
      signal: controller.signal,
    });
    const contentType = r.headers.get("content-type") || "";
    if (contentType.includes("text/html") && !contentType.includes("application/json")) {
      throw new CatalogError("El servidor respondió con HTML en lugar de JSON. Verifica la conexión con la API.", r.status);
    }
    const text = await r.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new CatalogError("Respuesta no válida del servidor.", r.status);
      }
    }
    if (!r.ok)
      throw new CatalogError(
        Array.isArray(data.message)
          ? data.message.join(". ")
          : data.message || "No se pudo cargar el catálogo.",
        r.status,
      );
    if (path.startsWith("?") && !new URLSearchParams(path.slice(1)).has("generoId")) {
      const q = new URLSearchParams(path.slice(1));
      try {
        const offset = (Number(q.get("page") || 1) - 1) * 12;
        const term = q.get("q")?.trim();
        if (term && term.length < 2) return data as T;
        const remote = await audiusRequest(cleanBase, term ? "/search?query=" + encodeURIComponent(term) + "&limit=12&offset=" + offset : "/trending?limit=12&offset=" + offset, token, signal);
        const tracks = remote.tracks || remote.data || [];
        // Búsqueda de artistas: sus pistas también forman parte de los resultados.
        const artists = remote.artists || [];
        const byArtist = term && artists.length ? await audiusRequest(cleanBase, "/artists/" + encodeURIComponent(artists[0].id) + "/tracks?limit=6", token, signal).catch(() => ({data: []})) : {data: []};
        const unique = new Map([...tracks, ...byArtist.data].map((t: AudiusTrack) => [t.id, externalSong(t)]));
        data.items.push(...unique.values());
        // El proveedor no comunica un total exacto: solo contamos lo recibido.
        data.total += unique.size;
        if (tracks.length === 12) data.totalPages = Math.max(data.totalPages, Number(q.get("page") || 1) + 1);
      } catch { data.externalError = "Audius no está disponible. El catálogo local sigue operativo."; }
    }
    return data as T;
  } catch (e) {
    if (signal?.aborted) throw e;
    if (
      e instanceof TypeError ||
      (e instanceof Error && e.name === "AbortError")
    )
      throw new Error("No se pudo conectar al catálogo. Inténtalo de nuevo.");
    throw e;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
export function catalogCoverUrl(base: string, reference: string | null) {
  if (!reference) return undefined;
  if (/^https?:\/\//i.test(reference)) return reference;
  const cleanBase = resolveApiBase(base);
  if (/^\/api\//.test(reference)) return cleanBase.replace(/\/api\/?$/, "") + reference;
  if (/^[a-f0-9-]+\.(jpe?g|png|webp|svg)$/i.test(reference)) {
    return cleanBase.replace(/\/api\/?$/, "") + "/images/" + reference;
  }
  return reference.startsWith("/") ? cleanBase.replace(/\/api\/?$/, "") + reference : undefined;
}
export function catalogDuration(value: number | null) {
  return value === null
    ? "—"
    : Math.floor(value / 60) + ":" + (value % 60).toString().padStart(2, "0");
}

// Contrato externo mínimo; nunca se persiste en las entidades locales.
type AudiusTrack = {id:string; title:string; artist:{id:string; name:string}; genre:string|null; durationSeconds:number|null; artworkUrl:string|null; isPlayable:boolean};
function externalSong(t: AudiusTrack): CatalogSong {
 return {id:t.id, source:"AUDIUS", titulo:t.title, artista:{id:t.artist.id,nombre:t.artist.name},genero:t.genre?{id:"audius:"+t.genre,nombre:t.genre}:null,duracionSegundos:t.durationSeconds,coverUrl:t.artworkUrl,descripcion:"Fuente: Audius",playable:t.isPlayable};
}
async function audiusRequest(base:string,path:string,token?:string,signal?:AbortSignal) {
 const cleanBase = resolveApiBase(base);
 const activeToken = resolveAuthToken(token);
 const controller = new AbortController();
 const abort = () => controller.abort();
 const timer = setTimeout(abort, 10000);
 signal?.addEventListener("abort", abort);
 if (signal?.aborted) abort();
 try {
   const r = await fetch(cleanBase+"/auth/integrations/audius"+path,{credentials:"include",headers:activeToken?{Authorization:"Bearer "+activeToken}:{},signal:controller.signal});
   const contentType = r.headers.get("content-type") || "";
   if (contentType.includes("text/html") && !contentType.includes("application/json")) {
     throw new Error("Respuesta no válida de Audius.");
   }
   const text = await r.text();
   if(!r.ok) throw new Error("Audius no disponible o pista restringida.");
   return text ? JSON.parse(text) : {};
 } finally { clearTimeout(timer); signal?.removeEventListener("abort", abort); }
}
