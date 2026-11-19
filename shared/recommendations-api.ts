import type { MusicRecommendationsResponse } from './recommendations';

export async function fetchMusicRecommendations(
  base: string,
  token?: string,
  limit = 10,
  signal?: AbortSignal,
): Promise<MusicRecommendationsResponse> {
  const url = `${base.replace(/\/+$/, '')}/auth/recommendations/music?limit=${limit}`;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    method: 'GET',
    credentials: 'include',
    headers,
    signal,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message ||
        `Error ${response.status}: no se pudieron obtener las recomendaciones`,
    );
  }

  return response.json();
}
