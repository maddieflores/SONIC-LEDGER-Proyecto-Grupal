import { resolveApiBase, resolveAuthToken } from './api-config.js';
import type { MusicRecommendationsResponse } from './recommendations';

export async function fetchMusicRecommendations(
  base: string,
  token?: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<MusicRecommendationsResponse> {
  const cleanBase = resolveApiBase(base).replace(/\/+$/, '');
  const url = `${cleanBase}/auth/recommendations/music?limit=${limit}`;
  const activeToken = resolveAuthToken(token);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (activeToken) {
    headers['Authorization'] = `Bearer ${activeToken}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers,
    signal,
  });

  const contentType = response.headers?.get('content-type') || '';
  if (contentType.includes('text/html')) {
    throw new Error('El servidor devolvió HTML en lugar de JSON. Verifica la URL de la API.');
  }

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message ||
        `Error ${response.status}: no se pudieron obtener las recomendaciones`,
    );
  }

  return response.json();
}
