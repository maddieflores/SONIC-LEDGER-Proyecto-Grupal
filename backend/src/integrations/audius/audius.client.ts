import {
  BadGatewayException,
  Injectable,
  Logger,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import { assertAudiusDestination } from './destination.js';
import { ConfigService } from '@nestjs/config';
import {
  AudiusApiResponse,
  AudiusTrack,
  AudiusUser,
} from './audius.types.js';

@Injectable()
export class AudiusClient {
  private readonly logger = new Logger(AudiusClient.name);
  private readonly baseUrl: string;
  private readonly appName: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    const rawBaseUrl =
      this.configService.get<string>('AUDIUS_BASE_URL') ||
      'https://api.audius.co/v1';
    if (rawBaseUrl !== 'https://api.audius.co/v1') throw new Error('AUDIUS_BASE_URL debe ser la API oficial HTTPS');
    this.baseUrl = rawBaseUrl.replace(/\/+$/, '');
    this.appName =
      this.configService.get<string>('AUDIUS_APP_NAME') || 'SonicLedger';
    this.apiKey = this.configService.get<string>('AUDIUS_API_KEY') || undefined;
    const timeout = Number(this.configService.get<string>('AUDIUS_TIMEOUT_MS'));
    this.timeoutMs = !isNaN(timeout) && timeout > 0 ? timeout : 8000;
  }

  /**
   * Construye los headers HTTP sin exponer credenciales en logs.
   */
  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': `SonicLedger-Backend/1.0 (${this.appName})`,
    };
    if (this.apiKey) {
      headers['x-api-key'] = this.apiKey;
    }
    return headers;
  }

  /**
   * Construye la URL completa agregando app_name y parámetros de consulta.
   */
  private buildUrl(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
  ): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const url = new URL(`${this.baseUrl}${cleanEndpoint}`);

    url.searchParams.set('app_name', this.appName);


    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }

    return url.toString();
  }

  /**
   * Ejecuta peticiones HTTP con control de timeout y manejo seguro de errores.
   */
  async request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined> = {},
    options: { redirect?: RequestRedirect } = {},
  ): Promise<T> {
    const fullUrl = this.buildUrl(endpoint, params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
        redirect: options.redirect || 'error',
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new NotFoundException(
            `El recurso solicitado en Audius (${endpoint}) no fue encontrado`,
          );
        }
        if (response.status >= 500) {
          throw new BadGatewayException(
            `El nodo de Audius respondió con error de servidor (HTTP ${response.status})`,
          );
        }
        throw new BadGatewayException(
          `Error en la comunicación con Audius (HTTP ${response.status})`,
        );
      }

      const body = (await response.json()) as AudiusApiResponse<T>;
      return body.data;
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }

      if (error instanceof Error && error.name === 'AbortError') {
        this.logger.warn(`Timeout al comunicarse con Audius (${endpoint}) tras ${this.timeoutMs}ms`);
        throw new RequestTimeoutException(
          `Audius no respondió dentro del límite de tiempo configurado (${this.timeoutMs}ms)`,
        );
      }

      const errMessage = 'Conexión externa fallida';
      this.logger.error(`Error en la solicitud a Audius [${endpoint}]: ${errMessage}`);
      throw new BadGatewayException(
        'Fallo de conexión al comunicarse con el proveedor externo Audius',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Consulta pistas en tendencia en Audius.
   */
  async getTrendingTracks(params: {
    limit?: number;
    offset?: number;
    genre?: string;
    time?: string;
  }): Promise<AudiusTrack[]> {
    return this.request<AudiusTrack[]>('/tracks/trending', {
      limit: params.limit,
      offset: params.offset,
      genre: params.genre,
      time: params.time,
    });
  }

  /**
   * Busca pistas en Audius por coincidencia de texto.
   */
  async searchTracks(params: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<AudiusTrack[]> {
    return this.request<AudiusTrack[]>('/tracks/search', {
      query: params.query,
      limit: params.limit,
      offset: params.offset,
    });
  }

  /**
   * Busca artistas/usuarios en Audius por coincidencia de texto.
   */
  async searchUsers(params: {
    query: string;
    limit?: number;
    offset?: number;
  }): Promise<AudiusUser[]> {
    return this.request<AudiusUser[]>('/users/search', {
      query: params.query,
      limit: params.limit,
      offset: params.offset,
    });
  }

  /**
   * Obtiene los metadatos de una pista individual por su ID de Audius.
   */
  async getTrackById(trackId: string): Promise<AudiusTrack> {
    return this.request<AudiusTrack>(`/tracks/${encodeURIComponent(trackId)}`);
  }

  /**
   * Obtiene los datos del perfil de un usuario/artista por su ID de Audius.
   */
  async getUserById(userId: string): Promise<AudiusUser> {
    return this.request<AudiusUser>(`/users/${encodeURIComponent(userId)}`);
  }

  /**
   * Obtiene el catálogo de pistas publicadas por un usuario/artista específico.
   */
  async getUserTracks(
    userId: string,
    params: { limit?: number; offset?: number; sort?: string } = {},
  ): Promise<AudiusTrack[]> {
    return this.request<AudiusTrack[]>(
      `/users/${encodeURIComponent(userId)}/tracks`,
      {
        limit: params.limit,
        offset: params.offset,
        sort: params.sort,
      },
    );
  }

  /**
   * Resuelve la redirección 302 oficial del endpoint de streaming de Audius (/tracks/:id/stream).
   */
  async resolveTrackStreamUrl(trackId: string): Promise<string | null> {
    const fullUrl = this.buildUrl(`/tracks/${encodeURIComponent(trackId)}/stream`);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      // Usamos redirect: 'manual' para capturar la cabecera Location del 302 sin descargar bytes de audio
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: this.getHeaders(),
        signal: controller.signal,
        redirect: 'manual',
      });

      if (response.status === 302 || response.status === 301 || response.status === 307) {
        const location = response.headers.get('location');
        if (location) {
          assertAudiusDestination(location);
          return location;
        }
      }

      if (response.ok && response.url && response.url !== fullUrl) {
        return response.url;
      }

      // Si no hubo redirección pero la URL directa responde, se devuelve la URL construida
      await response.body?.cancel();
      throw new BadGatewayException('No se pudo resolver streaming autorizado');
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new RequestTimeoutException('Timeout al resolver streaming en Audius');
      }
      this.logger.warn('No se pudo resolver streaming Audius');
      throw new BadGatewayException('Streaming Audius no disponible');
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
