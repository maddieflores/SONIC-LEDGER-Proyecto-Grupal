import { resolveApiBase } from './api-config.js';

export class ArtistApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}
export async function artistRequest<T>(
  base: string,
  path: string,
  method = "GET",
  body?: unknown,
  token?: string,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const multipart =
      typeof FormData !== "undefined" && body instanceof FormData;
    const cleanBase = resolveApiBase(base).replace(/\/+$/, '');
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const r = await fetch(cleanBase + "/auth/" + cleanPath, {
      method,
      credentials: "include",
      headers: {
        ...(multipart ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: "Bearer " + token } : {}),
      },
      ...(body === undefined
        ? {}
        : { body: multipart ? (body as FormData) : JSON.stringify(body) }),
      signal: controller.signal,
    });

    const contentType = r.headers?.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new ArtistApiError(
        'El servidor devolvió HTML en lugar de JSON. Verifica la URL de la API.',
        r.status,
      );
    }

    let data: any = {};
    try {
      data = await r.json();
    } catch {
      throw new ArtistApiError('Respuesta no válida del servidor.', r.status);
    }

    if (!r.ok)
      throw new ArtistApiError(
        Array.isArray(data.message)
          ? data.message.join(". ")
          : data.message || "No se pudo completar la solicitud.",
        r.status,
      );
    return data as T;
  } catch (e) {
    if (
      e instanceof TypeError ||
      (e instanceof Error && e.name === "AbortError")
    )
      throw new Error("No se pudo conectar al servidor. Inténtalo de nuevo.");
    throw e;
  } finally {
    clearTimeout(timeout);
  }
}
export function artistMediaUrl(base: string, reference: string | null) {
  if (
    !reference ||
    !/^\/api\/auth\/artist-profile\/media\/[a-f0-9-]+\.(png|jpg)$/.test(
      reference,
    )
  )
    return undefined;
  return base.replace(/\/api\/?$/, "") + reference;
}
