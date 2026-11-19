export function getApiBaseUrl(): string {
  let envUrl = (import.meta.env.VITE_API_URL || '').trim();
  if (typeof window !== 'undefined' && window.location.hostname.includes('onrender.com') && (!envUrl || envUrl === '/api')) {
    return 'https://sonic-ledger-api.onrender.com/api';
  }
  if (!envUrl || envUrl === '/api') {
    return 'http://localhost:3000/api';
  }
  envUrl = envUrl.replace(/\/+$/, '');
  if (!envUrl.endsWith('/api') && /^https?:\/\//i.test(envUrl)) {
    envUrl = `${envUrl}/api`;
  }
  return envUrl;
}

const BASE = getApiBaseUrl();

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type User = { id: string; username: string; email: string; role: string };

export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const activeToken = token ?? (typeof localStorage !== 'undefined' ? localStorage.getItem('token') ?? undefined : undefined);

  try {
    const response = await fetch(BASE + '/auth/' + path, {
      credentials: 'include',
      method: body === undefined ? 'GET' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(activeToken ? { Authorization: 'Bearer ' + activeToken } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: controller.signal,
    });

    const contentType = response.headers?.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new ApiError('El servidor devolvió HTML en lugar de JSON. Verifica la URL de la API.', response.status);
    }

    const text = await response.text();
    let data: any = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        throw new ApiError('Respuesta no válida del servidor.', response.status);
      }
    }

    if (!response.ok) {
      const msg = Array.isArray(data.message)
        ? data.message.join('. ')
        : data.message || (response.status === 200 && !text ? 'Error al procesar la respuesta del servidor.' : 'No se pudo completar la solicitud.');
      throw new ApiError(msg, response.status);
    }

    return data as T;
  } catch (error) {
    if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) {
      throw new Error('No se pudo conectar al servidor. Inténtalo de nuevo.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
