import { resolveApiBase, resolveAuthToken } from './api-config.js';
import type {
  AddConcertArtistPayload,
  Concert,
  ConcertArtist,
  ConcertQuery,
  ConcertsResponse,
  ConcertTicketCategory,
  CreateConcertPayload,
  CreateTicketCategoryPayload,
  UpdateConcertPayload,
  UpdateTicketCategoryPayload,
  RecommendedConcertsResponse,
} from './concerts.js';

export class ConcertApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function concertRequest<T>(
  base: string,
  path: string,
  method = 'GET',
  body?: unknown,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const isFormData =
      typeof FormData !== 'undefined' && body instanceof FormData;
    const cleanBase = resolveApiBase(base);
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    const url = `${cleanBase}${cleanPath}`;
    const activeToken = resolveAuthToken(token);

    const headers: Record<string, string> = {};
    if (!isFormData) {
      headers['Content-Type'] = 'application/json';
    }
    if (activeToken) {
      headers['Authorization'] = `Bearer ${activeToken}`;
    }

    const r = await fetch(url, {
      method,
      credentials: 'include',
      headers,
      body:
        body === undefined
          ? undefined
          : isFormData
            ? (body as FormData)
            : JSON.stringify(body),
      signal: controller.signal,
    });

    const contentType = r.headers.get('content-type') || '';
    if (contentType.includes('text/html') && !contentType.includes('application/json')) {
      throw new ConcertApiError('El servidor respondió con HTML en lugar de JSON. Verifica la conexión con la API.', r.status);
    }
    const text = await r.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ConcertApiError('Respuesta no válida del servidor.', r.status);
      }
    }
    if (!r.ok) {
      throw new ConcertApiError(
        Array.isArray(data.message)
          ? data.message.join('. ')
          : data.message || 'No se pudo completar la solicitud.',
        r.status,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchPublicConcerts(
  query: ConcertQuery = {},
  base = '/api',
): Promise<ConcertsResponse> {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (query.ciudad) params.set('ciudad', query.ciudad);
  if (query.genero) params.set('genero', query.genero);
  if (query.fechaDesde) params.set('fechaDesde', query.fechaDesde);
  if (query.fechaHasta) params.set('fechaHasta', query.fechaHasta);
  if (query.artistaId) params.set('artistaId', query.artistaId);
  if (query.destacados) params.set('destacados', 'true');
  if (query.page) params.set('page', String(query.page));
  if (query.limit) params.set('limit', String(query.limit));
  if (query.sort) params.set('sort', query.sort);

  const qs = params.toString();
  return concertRequest<ConcertsResponse>(
    base,
    `/conciertos${qs ? '?' + qs : ''}`,
  );
}

export async function fetchPublicConcertDetail(
  id: string,
  base = '/api',
  token?: string,
): Promise<Concert> {
  return concertRequest<Concert>(base, `/conciertos/${id}`, 'GET', undefined, token);
}

export async function fetchOrganizerConcerts(
  token?: string,
  base = '/api',
): Promise<Concert[]> {
  return concertRequest<Concert[]>(
    base,
    '/conciertos/mis-conciertos',
    'GET',
    undefined,
    token,
  );
}

export async function fetchOrganizerConcertDetail(
  id: string,
  token?: string,
  base = '/api',
): Promise<Concert> {
  return concertRequest<Concert>(
    base,
    `/conciertos/organizador/${id}`,
    'GET',
    undefined,
    token,
  );
}

export async function createConcertDraft(
  payload: CreateConcertPayload,
  token?: string,
  base = '/api',
): Promise<Concert> {
  return concertRequest<Concert>(
    base,
    '/conciertos',
    'POST',
    payload,
    token,
  );
}

export async function updateConcert(
  id: string,
  payload: UpdateConcertPayload,
  token?: string,
  base = '/api',
): Promise<Concert> {
  return concertRequest<Concert>(
    base,
    `/conciertos/${id}`,
    'PUT',
    payload,
    token,
  );
}

export async function uploadConcertCover(
  id: string,
  file: File | Blob,
  token?: string,
  base = '/api',
): Promise<{ coverUrl: string }> {
  const formData = new FormData();
  formData.append('file', file);
  return concertRequest<{ coverUrl: string }>(
    base,
    `/conciertos/${id}/cover`,
    'POST',
    formData,
    token,
  );
}

export async function addConcertCategory(
  id: string,
  payload: CreateTicketCategoryPayload,
  token?: string,
  base = '/api',
): Promise<ConcertTicketCategory> {
  return concertRequest<ConcertTicketCategory>(
    base,
    `/conciertos/${id}/categorias`,
    'POST',
    payload,
    token,
  );
}

export async function updateConcertCategory(
  id: string,
  catId: string,
  payload: UpdateTicketCategoryPayload,
  token?: string,
  base = '/api',
): Promise<ConcertTicketCategory> {
  return concertRequest<ConcertTicketCategory>(
    base,
    `/conciertos/${id}/categorias/${catId}`,
    'PUT',
    payload,
    token,
  );
}

export async function deleteConcertCategory(
  id: string,
  catId: string,
  token?: string,
  base = '/api',
): Promise<{ success: boolean }> {
  return concertRequest<{ success: boolean }>(
    base,
    `/conciertos/${id}/categorias/${catId}`,
    'DELETE',
    undefined,
    token,
  );
}

export async function addConcertArtist(
  id: string,
  payload: AddConcertArtistPayload,
  token?: string,
  base = '/api',
): Promise<ConcertArtist> {
  return concertRequest<ConcertArtist>(
    base,
    `/conciertos/${id}/artistas`,
    'POST',
    payload,
    token,
  );
}

export async function deleteConcertArtist(
  id: string,
  relId: string,
  token?: string,
  base = '/api',
): Promise<{ success: boolean }> {
  return concertRequest<{ success: boolean }>(
    base,
    `/conciertos/${id}/artistas/${relId}`,
    'DELETE',
    undefined,
    token,
  );
}

export async function publishConcert(
  id: string,
  token?: string,
  base = '/api',
): Promise<Concert> {
  return concertRequest<Concert>(
    base,
    `/conciertos/${id}/publicar`,
    'POST',
    undefined,
    token,
  );
}

export async function fetchPlatformArtists(
  base = '/api',
): Promise<Array<{ id: string; nombre: string; avatarUrl?: string | null }>> {
  return concertRequest<Array<{ id: string; nombre: string; avatarUrl?: string | null }>>(
    base,
    '/conciertos/artistas-plataforma',
  );
}

// Cancelación de concierto (CU17)
export async function cancelarConcierto(
  id: string,
  payload: { motivo: string },
  token?: string,
  base = '/api',
): Promise<{ success: boolean; concierto: Concert; mensaje: string }> {
  return concertRequest<{ success: boolean; concierto: Concert; mensaje: string }>(
    base,
    `/conciertos/${id}/cancelar`,
    'POST',
    payload,
    token,
  );
}

export async function obtenerCancelacionConcierto(
  id: string,
  token?: string,
  base = '/api',
): Promise<{
  conciertoId: string;
  titulo: string;
  estado: string;
  motivoCancelacion: string;
  canceladoEn: string;
  totalTicketsAfectados: number;
  totalOrdenesAfectadas: number;
  totalMontoAfectadoBob: number;
  pagosPrueba: boolean;
}> {
  return concertRequest(
    base,
    `/conciertos/${id}/cancelacion`,
    'GET',
    undefined,
    token,
  );
}

// CU19 — Obtener recomendaciones de conciertos
export async function fetchRecommendedConcerts(
  token?: string,
  query?: { limit?: number; ciudad?: string },
  base = '/api',
): Promise<RecommendedConcertsResponse> {
  const params = new URLSearchParams();
  if (query?.limit) params.set('limit', String(query.limit));
  if (query?.ciudad) params.set('ciudad', query.ciudad);
  const qStr = params.toString() ? `?${params.toString()}` : '';

  return concertRequest<RecommendedConcertsResponse>(
    base,
    `/conciertos/recomendados${qStr}`,
    'GET',
    undefined,
    token,
  );
}
