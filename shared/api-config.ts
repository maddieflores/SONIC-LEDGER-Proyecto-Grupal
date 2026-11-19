/**
 * Resuelve la URL base absoluta hacia la API de Sonic Ledger.
 * Si se ejecuta en el navegador sobre un dominio de Render (*.onrender.com)
 * y la base es relativa (/api) o vacía, resuelve automáticamente hacia el backend de Render.
 * En desarrollo local resuelve hacia http://localhost:3000/api.
 * Garantiza que nunca se duplique el segmento /api.
 */
export function resolveApiBase(base?: string): string {
  let url = (base || '').trim();

  // Si no se proporcionó base o es solo '/api', detectar si estamos en Render Web
  if (!url || url === '/api') {
    if (typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname.includes('onrender.com')) {
        return 'https://sonic-ledger-api.onrender.com/api';
      }
    }
    return 'http://localhost:3000/api';
  }

  // Si ya es una URL relativa o absoluta, normalizar
  url = url.replace(/\/+$/, '');
  if (!url.endsWith('/api') && /^https?:\/\//i.test(url)) {
    url = `${url}/api`;
  }
  return url;
}

/**
 * Resuelve el token de autenticación para peticiones a la API.
 * Si se pasa explícitamente se respeta.
 * Si no, en entorno de navegador intenta obtenerlo de localStorage ('token').
 */
export function resolveAuthToken(token?: string): string | undefined {
  if (token) return token;
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const stored = localStorage.getItem('token');
      return stored || undefined;
    }
  } catch {
    // Entorno no accesible o seguro
  }
  return undefined;
}
