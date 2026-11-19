const BASE = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

export class ApiError extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } }
export type User = { id: string; username: string; email: string; role: string };

export async function request<T>(path: string, body?: unknown, token?: string): Promise<T> {

 const controller = new AbortController();

 const timeout = setTimeout(() => controller.abort(), 15000);

 try {

  const response = await fetch(BASE + '/auth/' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: controller.signal });

  const data = await response.json();

  if (!response.ok) throw new ApiError(Array.isArray(data.message) ? data.message.join('. ') : data.message || 'No se pudo completar la solicitud.', response.status);

  return data as T;

 } catch (error) { if (error instanceof TypeError || (error instanceof Error && error.name === 'AbortError')) throw new Error('No se pudo conectar al servidor. Inténtalo de nuevo.'); throw error; }

 finally { clearTimeout(timeout); }

}

