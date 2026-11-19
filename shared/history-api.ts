import { resolveApiBase } from './api-config.js';
import type { CatalogSong } from './catalog.js';
import type {
  HistoryEventType,
  MusicalStatsResponse,
  PaginatedHistory,
  PlaybackEventPayload,
  StatsPeriodo,
} from './history.js';

export class HistoryApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function historyRequest<T>(
  base: string,
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const cleanBase = resolveApiBase(base);
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const url = `${cleanBase}${cleanPath}`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const r = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = r.headers.get('content-type') || '';
    if (contentType.includes('text/html') && !contentType.includes('application/json')) {
      throw new HistoryApiError('El servidor respondió con HTML en lugar de JSON. Verifica la conexión con la API.', r.status);
    }
    const text = await r.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new HistoryApiError('Respuesta no válida del servidor.', r.status);
      }
    }
    if (!r.ok) {
      throw new HistoryApiError(
        Array.isArray(data.message)
          ? data.message.join('. ')
          : data.message || 'No se pudo completar la solicitud.',
        r.status,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof HistoryApiError) throw e;
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

/**
 * Registra un evento de escucha (PLAYED o SKIPPED) en el historial.
 */
export async function recordPlaybackEvent(
  base: string,
  payload: PlaybackEventPayload,
  token?: string,
): Promise<any> {
  return historyRequest<any>(
    base,
    '/auth/history/events',
    'POST',
    payload,
    token,
  );
}

/**
 * Consulta el historial de reproducción paginado con filtro opcional de tipo de evento.
 */
export async function fetchUserHistory(
  base: string,
  query?: { page?: number; pageSize?: number; eventType?: HistoryEventType | 'ALL' },
  token?: string,
): Promise<PaginatedHistory> {
  const params = new URLSearchParams();
  if (query?.page) params.set('page', String(query.page));
  if (query?.pageSize) params.set('pageSize', String(query.pageSize));
  if (query?.eventType && query.eventType !== 'ALL') {
    params.set('eventType', query.eventType);
  }

  const qs = params.toString();
  return historyRequest<PaginatedHistory>(
    base,
    `/auth/history${qs ? `?${qs}` : ''}`,
    'GET',
    undefined,
    token,
  );
}

/**
 * Consulta canciones escuchadas recientemente para acceso rápido.
 */
export async function fetchRecentTracks(
  base: string,
  limit = 20,
  token?: string,
): Promise<CatalogSong[]> {
  return historyRequest<CatalogSong[]>(
    base,
    `/auth/history/recent?limit=${limit}`,
    'GET',
    undefined,
    token,
  );
}

/**
 * Elimina una entrada específica del historial.
 */
export async function deleteHistoryEntry(
  base: string,
  id: string,
  token?: string,
): Promise<{ deleted: boolean; id: string }> {
  return historyRequest<{ deleted: boolean; id: string }>(
    base,
    `/auth/history/${id}`,
    'DELETE',
    undefined,
    token,
  );
}

/**
 * Limpia todo el historial de reproducción del usuario.
 */
export async function clearUserHistory(
  base: string,
  token?: string,
): Promise<{ cleared: boolean; count: number }> {
  return historyRequest<{ cleared: boolean; count: number }>(
    base,
    '/auth/history',
    'DELETE',
    undefined,
    token,
  );
}

/**
 * CU23 — Consulta las estadísticas musicales agregadas del usuario para un periodo dado.
 */
export async function fetchMusicalStats(
  periodo: StatsPeriodo = '30d',
  token?: string,
  base = '/api',
): Promise<MusicalStatsResponse> {
  return historyRequest<MusicalStatsResponse>(
    base,
    `/auth/history/estadisticas?periodo=${periodo}`,
    'GET',
    undefined,
    token,
  );
}
