import { resolveApiBase, resolveAuthToken } from './api-config.js';
import type {
  AvailableSong,
  Release,
  ReleasesQuery,
  ReleasesResponse,
  ReleaseTipo,
} from './releases.js';

export class ReleaseApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function releaseRequest<T>(
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
      throw new ReleaseApiError('El servidor respondió con HTML en lugar de JSON. Verifica la conexión con la API.', r.status);
    }
    const text = await r.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ReleaseApiError('Respuesta no válida del servidor.', r.status);
      }
    }
    if (!r.ok) {
      throw new ReleaseApiError(
        Array.isArray(data.message)
          ? data.message.join('. ')
          : data.message || 'No se pudo completar la solicitud.',
        r.status,
      );
    }
    return data as T;
  } catch (e) {
    if (e instanceof ReleaseApiError) throw e;
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

export function releaseCoverUrl(
  base: string,
  reference: string | null | undefined,
): string | undefined {
  if (!reference) return undefined;
  if (reference.startsWith('http')) return reference;
  const host = base.replace(/\/api\/?$/, '');
  return `${host}${reference.startsWith('/') ? reference : '/' + reference}`;
}

export async function fetchArtistReleases(
  base: string,
  query: ReleasesQuery = {},
  token?: string,
): Promise<ReleasesResponse> {
  const params = new URLSearchParams();
  if (query.tipo) params.set('tipo', query.tipo);
  if (query.estado) params.set('estado', query.estado);
  if (query.q) params.set('q', query.q);
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  return releaseRequest<ReleasesResponse>(
    base,
    `/auth/artist/releases${queryStr}`,
    'GET',
    undefined,
    token,
  );
}

export async function fetchReleaseDetail(
  base: string,
  id: string,
  token?: string,
): Promise<Release> {
  return releaseRequest<Release>(
    base,
    `/auth/artist/releases/${id}`,
    'GET',
    undefined,
    token,
  );
}

export async function fetchAvailableSongs(
  base: string,
  token?: string,
): Promise<AvailableSong[]> {
  return releaseRequest<AvailableSong[]>(
    base,
    '/auth/artist/releases/available-songs',
    'GET',
    undefined,
    token,
  );
}

export async function createReleaseDraft(
  base: string,
  dto: { titulo: string; tipo: ReleaseTipo; descripcion?: string },
  token?: string,
): Promise<Release> {
  return releaseRequest<Release>(
    base,
    '/auth/artist/releases',
    'POST',
    dto,
    token,
  );
}

export async function updateReleaseDraft(
  base: string,
  id: string,
  dto: { titulo?: string; tipo?: ReleaseTipo; descripcion?: string },
  token?: string,
): Promise<Release> {
  return releaseRequest<Release>(
    base,
    `/auth/artist/releases/${id}`,
    'PATCH',
    dto,
    token,
  );
}

export async function deleteRelease(
  base: string,
  id: string,
  token?: string,
): Promise<{ deleted: boolean; id: string }> {
  return releaseRequest<{ deleted: boolean; id: string }>(
    base,
    `/auth/artist/releases/${id}`,
    'DELETE',
    undefined,
    token,
  );
}

export async function setReleaseTracks(
  base: string,
  id: string,
  trackIds: string[],
  token?: string,
): Promise<Release> {
  return releaseRequest<Release>(
    base,
    `/auth/artist/releases/${id}/tracks`,
    'PUT',
    { trackIds },
    token,
  );
}

export async function publishRelease(
  base: string,
  id: string,
  token?: string,
): Promise<Release> {
  return releaseRequest<Release>(
    base,
    `/auth/artist/releases/${id}/publish`,
    'POST',
    undefined,
    token,
  );
}

export async function uploadReleaseCover(
  base: string,
  id: string,
  file: FormData,
  token?: string,
): Promise<Release> {
  return releaseRequest<Release>(
    base,
    `/auth/artist/releases/${id}/cover`,
    'POST',
    file,
    token,
  );
}
