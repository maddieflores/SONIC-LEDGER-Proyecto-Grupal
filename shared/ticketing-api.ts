import { resolveApiBase, resolveAuthToken } from './api-config.js';
import type {
  AsignarVerificadorPayload,
  ConciertoAsignadoVerificador,
  CrearOrdenPayload,
  EstadisticasConcierto,
  OrdenCompra,
  ProcesarPagoPayload,
  ProcesarReembolsoSimuladoPayload,
  ReembolsoItem,
  ResultadoValidacion,
  ResumenEstadisticasOrganizador,
  ResumenReembolsosOrganizador,
  SolicitarReembolsoPayload,
  TicketDigital,
  ValidarQRPayload,
  VerificadorItem,
} from './ticketing.js';

export class TicketingApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function ticketingRequest<T>(
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
    const cleanBase = resolveApiBase(base).replace(/\/+$/, '');
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

    const contentType = r.headers?.get('content-type') || '';
    if (contentType.includes('text/html')) {
      throw new TicketingApiError(
        'El servidor devolvió HTML en lugar de JSON. Verifica la URL de la API.',
        r.status,
      );
    }

    let data: any = {};
    try {
      data = await r.json();
    } catch {
      throw new TicketingApiError(
        'Respuesta no válida del servidor.',
        r.status,
      );
    }

    if (!r.ok) {
      throw new TicketingApiError(
        Array.isArray(data.message)
          ? data.message.join('. ')
          : data.message || 'No se pudo completar la solicitud de ticketing.',
        r.status,
      );
    }
    return data as T;
  } finally {
    clearTimeout(timeout);
  }
}

// 1. Órdenes y Compra (CU20)
export async function crearReservaOrden(
  payload: CrearOrdenPayload,
  token?: string,
  base = '/api',
): Promise<OrdenCompra> {
  return ticketingRequest<OrdenCompra>(
    base,
    '/ticketing/ordenes',
    'POST',
    payload,
    token,
  );
}

export async function obtenerOrden(
  ordenId: string,
  token?: string,
  base = '/api',
): Promise<OrdenCompra> {
  return ticketingRequest<OrdenCompra>(
    base,
    `/ticketing/ordenes/${ordenId}`,
    'GET',
    undefined,
    token,
  );
}

export async function procesarPagoPrueba(
  payload: ProcesarPagoPayload,
  token?: string,
  base = '/api',
): Promise<{ orden: OrdenCompra; tickets: TicketDigital[] }> {
  return ticketingRequest<{ orden: OrdenCompra; tickets: TicketDigital[] }>(
    base,
    '/ticketing/pagos/simular',
    'POST',
    payload,
    token,
  );
}

// 2. Mis Entradas y QR (CU21)
export async function listarMisTickets(
  token?: string,
  base = '/api',
): Promise<TicketDigital[]> {
  return ticketingRequest<TicketDigital[]>(
    base,
    '/ticketing/mis-tickets',
    'GET',
    undefined,
    token,
  );
}

export async function obtenerDetalleTicket(
  ticketId: string,
  token?: string,
  base = '/api',
): Promise<TicketDigital> {
  return ticketingRequest<TicketDigital>(
    base,
    `/ticketing/tickets/${ticketId}`,
    'GET',
    undefined,
    token,
  );
}

// 3. Validación de Ingreso (CU22)
export async function validarIngresoQR(
  payload: ValidarQRPayload,
  token?: string,
  base = '/api',
): Promise<ResultadoValidacion> {
  return ticketingRequest<ResultadoValidacion>(
    base,
    '/ticketing/validar-qr',
    'POST',
    payload,
    token,
  );
}

export async function listarConciertosAsignadosVerificador(
  token?: string,
  base = '/api',
): Promise<ConciertoAsignadoVerificador[]> {
  return ticketingRequest<ConciertoAsignadoVerificador[]>(
    base,
    '/ticketing/verificador/conciertos',
    'GET',
    undefined,
    token,
  );
}

// 4. Gestión de Verificadores por el Organizador
export async function listarVerificadoresConcierto(
  conciertoId: string,
  token?: string,
  base = '/api',
): Promise<VerificadorItem[]> {
  return ticketingRequest<VerificadorItem[]>(
    base,
    `/ticketing/conciertos/${conciertoId}/verificadores`,
    'GET',
    undefined,
    token,
  );
}

export async function asignarVerificadorConcierto(
  conciertoId: string,
  payload: AsignarVerificadorPayload,
  token?: string,
  base = '/api',
): Promise<{ success: boolean; asignacionId: string }> {
  return ticketingRequest<{ success: boolean; asignacionId: string }>(
    base,
    `/ticketing/conciertos/${conciertoId}/verificadores`,
    'POST',
    payload,
    token,
  );
}

export async function removerVerificadorConcierto(
  conciertoId: string,
  verificadorUsuarioId: string,
  token?: string,
  base = '/api',
): Promise<{ success: boolean }> {
  return ticketingRequest<{ success: boolean }>(
    base,
    `/ticketing/conciertos/${conciertoId}/verificadores/${verificadorUsuarioId}`,
    'DELETE',
    undefined,
    token,
  );
}

export async function listarCuentasVerificadoresDisponibles(
  token?: string,
  base = '/api',
): Promise<Array<{ id: string; username: string; email: string; displayName: string | null }>> {
  return ticketingRequest<Array<{ id: string; username: string; email: string; displayName: string | null }>>(
    base,
    '/ticketing/verificadores-disponibles',
    'GET',
    undefined,
    token,
  );
}

// 5. Estadísticas de Ventas y Asistencia (CU24)
export async function obtenerEstadisticasConcierto(
  conciertoId: string,
  token?: string,
  base = '/api',
): Promise<EstadisticasConcierto> {
  return ticketingRequest<EstadisticasConcierto>(
    base,
    `/ticketing/organizador/conciertos/${conciertoId}/estadisticas`,
    'GET',
    undefined,
    token,
  );
}

export async function obtenerResumenEstadisticasOrganizador(
  token?: string,
  base = '/api',
): Promise<ResumenEstadisticasOrganizador> {
  return ticketingRequest<ResumenEstadisticasOrganizador>(
    base,
    '/ticketing/organizador/estadisticas/resumen',
    'GET',
    undefined,
    token,
  );
}

// 6. Reembolsos y Sandbox de Pruebas
export async function solicitarReembolso(
  payload: SolicitarReembolsoPayload,
  token?: string,
  base = '/api',
): Promise<ReembolsoItem> {
  return ticketingRequest<ReembolsoItem>(
    base,
    '/ticketing/reembolsos',
    'POST',
    payload,
    token,
  );
}

export async function obtenerReembolsosOrden(
  ordenId: string,
  token?: string,
  base = '/api',
): Promise<ReembolsoItem[]> {
  return ticketingRequest<ReembolsoItem[]>(
    base,
    `/ticketing/ordenes/${ordenId}/reembolsos`,
    'GET',
    undefined,
    token,
  );
}

export async function obtenerReembolsosConciertoOrganizador(
  conciertoId: string,
  token?: string,
  base = '/api',
): Promise<ResumenReembolsosOrganizador> {
  return ticketingRequest<ResumenReembolsosOrganizador>(
    base,
    `/ticketing/organizador/conciertos/${conciertoId}/reembolsos`,
    'GET',
    undefined,
    token,
  );
}

export async function procesarReembolsoSimulado(
  payload: ProcesarReembolsoSimuladoPayload,
  token?: string,
  base = '/api',
): Promise<ReembolsoItem> {
  return ticketingRequest<ReembolsoItem>(
    base,
    '/ticketing/sandbox/procesar-reembolso',
    'POST',
    payload,
    token,
  );
}

export async function obtenerConfigSandbox(
  token?: string,
  base = '/api',
): Promise<{
  habilitado: boolean;
  comercioId: string;
  entorno: string;
  aviso: string;
}> {
  return ticketingRequest<{
    habilitado: boolean;
    comercioId: string;
    entorno: string;
    aviso: string;
  }>(base, '/sandbox-gateway/status', 'GET', undefined, token);
}
