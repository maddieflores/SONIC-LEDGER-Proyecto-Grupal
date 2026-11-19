import { resolveApiBase, resolveAuthToken } from './api-config.js';
import type { CatalogSong } from './catalog.js';
import type {
  FavoriteResponse,
  PlaylistDetail,
  PlaylistSummary,
} from './library.js';

export class LibraryApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function libraryRequest<T>(
  base: string,
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const cleanBase = resolveApiBase(base).replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const url = `${cleanBase}${cleanPath}`;
    const activeToken = resolveAuthToken(token);

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const r = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = r.headers?.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new LibraryApiError(
        'El servidor devolvió HTML en lugar de JSON. Verifica la URL de la API.',
        r.status,
      );
    }

    let data: any = {};
    try {
      data = await r.json();
    } catch {
      throw new LibraryApiError('Respuesta no válida del servidor.', r.status);
    }

    if (!r.ok) {
      throw new LibraryApiError(
        Array.isArray(data.message)
          ? data.message.join('. ')
          : data.message || 'No se pudo completar la solicitud.',
        r.status,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof LibraryApiError) throw e;
    if (
      e instanceof TypeError ||
      (e instanceof Error && e.name === 'AbortError')
    ) {
      throw new Error('No se pudo conectar con el servidor.');
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}

// ==========================================
// PLAYLISTS (CU09)
// ==========================================

export async function fetchUserPlaylists(
  base: string,
  token?: string,
): Promise<PlaylistSummary[]> {
  return libraryRequest<PlaylistSummary[]>(
    base,
    '/auth/library/playlists',
    'GET',
    undefined,
    token,
  );
}

export async function fetchUserPlaylist(
  base: string,
  id: string,
  token?: string,
): Promise<PlaylistDetail> {
  return libraryRequest<PlaylistDetail>(
    base,
    `/auth/library/playlists/${id}`,
    'GET',
    undefined,
    token,
  );
}

export async function createUserPlaylist(
  base: string,
  dto: { nombre: string; descripcion?: string },
  token?: string,
): Promise<PlaylistDetail> {
  return libraryRequest<PlaylistDetail>(
    base,
    '/auth/library/playlists',
    'POST',
    dto,
    token,
  );
}

export async function updateUserPlaylist(
  base: string,
  id: string,
  dto: { nombre?: string; descripcion?: string },
  token?: string,
): Promise<PlaylistDetail> {
  return libraryRequest<PlaylistDetail>(
    base,
    `/auth/library/playlists/${id}`,
    'PATCH',
    dto,
    token,
  );
}

export async function deleteUserPlaylist(
  base: string,
  id: string,
  token?: string,
): Promise<{ deleted: boolean; id: string }> {
  return libraryRequest<{ deleted: boolean; id: string }>(
    base,
    `/auth/library/playlists/${id}`,
    'DELETE',
    undefined,
    token,
  );
}

export async function addTrackToUserPlaylist(
  base: string,
  playlistId: string,
  trackId: string,
  source?: 'LOCAL' | 'AUDIUS',
  token?: string,
): Promise<PlaylistDetail> {
  return libraryRequest<PlaylistDetail>(
    base,
    `/auth/library/playlists/${playlistId}/tracks`,
    'POST',
    { trackId, source },
    token,
  );
}

export async function removeTrackFromUserPlaylist(
  base: string,
  playlistId: string,
  trackId: string,
  token?: string,
): Promise<PlaylistDetail> {
  return libraryRequest<PlaylistDetail>(
    base,
    `/auth/library/playlists/${playlistId}/tracks/${encodeURIComponent(trackId)}`,
    'DELETE',
    undefined,
    token,
  );
}

export async function reorderUserPlaylistTracks(
  base: string,
  playlistId: string,
  trackIds: string[],
  token?: string,
): Promise<PlaylistDetail> {
  return libraryRequest<PlaylistDetail>(
    base,
    `/auth/library/playlists/${playlistId}/tracks`,
    'PUT',
    { trackIds },
    token,
  );
}

// ==========================================
// FAVORITOS (CU10)
// ==========================================

export async function fetchUserFavorites(
  base: string,
  token?: string,
): Promise<CatalogSong[]> {
  return libraryRequest<CatalogSong[]>(
    base,
    '/auth/library/favorites',
    'GET',
    undefined,
    token,
  );
}

export async function fetchUserFavoriteIds(
  base: string,
  token?: string,
): Promise<string[]> {
  return libraryRequest<string[]>(
    base,
    '/auth/library/favorites/ids',
    'GET',
    undefined,
    token,
  );
}

export async function checkFavorites(
  base: string,
  trackIds: string[],
  token?: string,
): Promise<Record<string, boolean>> {
  return libraryRequest<Record<string, boolean>>(
    base,
    '/auth/library/favorites/check',
    'POST',
    { trackIds },
    token,
  );
}

export async function toggleFavorite(
  base: string,
  trackId: string,
  isFavorite: boolean,
  source?: 'LOCAL' | 'AUDIUS',
  token?: string,
): Promise<FavoriteResponse> {
  if (isFavorite) {
    return libraryRequest<FavoriteResponse>(
      base,
      `/auth/library/favorites/${encodeURIComponent(trackId)}`,
      'DELETE',
      undefined,
      token,
    );
  } else {
    return libraryRequest<FavoriteResponse>(
      base,
      '/auth/library/favorites',
      'POST',
      { trackId, source },
      token,
    );
  }
}
