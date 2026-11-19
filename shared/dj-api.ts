import { resolveApiBase, resolveAuthToken } from './api-config.js';
import type { DjSession } from './dj';
import type { CatalogSong } from './catalog';
export async function djRequest<T>(base: string, path: string, token?: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100000);
  try {
    const cleanBase = resolveApiBase(base).replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const activeToken = resolveAuthToken(token);
    const response = await fetch(cleanBase + '/auth/dj' + cleanPath, {
      method: body === undefined ? 'GET' : 'POST', credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(activeToken ? { Authorization: 'Bearer ' + activeToken } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
    });

    const contentType = response.headers?.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new Error('El servidor devolvió HTML en lugar de JSON. Verifica la URL de la API.');
    }

    let data: any = {};
    try {
      data = await response.json();
    } catch {
      throw new Error('Respuesta no válida del servidor.');
    }

    if (!response.ok) {
      if (response.status === 401) {
        throw new Error('No autorizado. Tu sesión ha expirado o no has iniciado sesión.');
      }
      throw new Error(Array.isArray(data.message) ? data.message.join('. ') : data.message || 'No se pudo completar la solicitud del DJ');
    }
    return data as T;
  } finally { clearTimeout(timer); }
}
export function djChips(s: DjSession): string[] {
  return [ ...(s.constraints.genres || []), ...(s.constraints.excludedGenres || []).map(g => 'Sin ' + g), ...(s.constraints.activity ? [s.constraints.activity] : []), ...(s.constraints.favorites ? ['Afinidad con favoritas'] : []), String(s.constraints.count || 10) + ' canciones' ];
}
export type DjState = DjSession;
export type DjSong = CatalogSong;
