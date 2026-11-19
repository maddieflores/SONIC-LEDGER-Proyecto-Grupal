import type { DjSession } from './dj';
import type { CatalogSong } from './catalog';
export async function djRequest<T>(base: string, path: string, token?: string, body?: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 100000);
  try {
  const response = await fetch(base + '/auth/dj' + path, {
    method: body === undefined ? 'GET' : 'POST', credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: controller.signal,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join('. ') : data.message || 'No se pudo completar la solicitud del DJ');
  return data as T;
  } finally { clearTimeout(timer); }
}
export function djChips(s: DjSession): string[] {
  return [ ...(s.constraints.genres || []), ...(s.constraints.excludedGenres || []).map(g => 'Sin ' + g), ...(s.constraints.activity ? [s.constraints.activity] : []), ...(s.constraints.favorites ? ['Afinidad con favoritas'] : []), String(s.constraints.count || 10) + ' canciones' ];
}
export type DjState = DjSession;
export type DjSong = CatalogSong;
