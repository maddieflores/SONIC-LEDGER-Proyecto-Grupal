export type ConcertEstado = 'BORRADOR' | 'PUBLICADO' | 'CANCELADO';

export type ConcertEstadoVenta =
  | 'VENTA_NO_INICIADA'
  | 'VENTA_PENDIENTE'
  | 'VENTA_INICIADA'
  | 'VENTA_CERRADA';

export type ConcertArtist = {
  id: string;
  conciertoId: string;
  artistaId: string | null;
  nombreArtista: string;
  orden: number;
  avatarUrl?: string | null;
};

export type ConcertTicketCategory = {
  id: string;
  conciertoId: string;
  nombre: string;
  precio: number;
  moneda: string;
  cupoTotal: number;
  cupoDisponible: number;
  disponible: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Concert = {
  id: string;
  organizadorId: string;
  organizadorNombre?: string;
  titulo: string;
  descripcion: string;
  portadaUrl: string | null;
  genero: string;
  fechaInicio: string;
  fechaFin: string;
  zonaHoraria: string;
  recinto: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  estado: ConcertEstado;
  inicioVenta: string | null;
  destacado: boolean;
  estadoVenta: ConcertEstadoVenta;
  precioMinimo: number | null;
  motivoCancelacion?: string | null;
  canceladoEn?: string | null;
  canceladoPorNombre?: string | null;
  artistas: ConcertArtist[];
  categorias: ConcertTicketCategory[];
  createdAt: string;
  updatedAt: string;
};

export type PublicConcertSummary = {
  id: string;
  titulo: string;
  descripcion?: string;
  portadaUrl: string | null;
  genero: string;
  fechaInicio: string;
  fechaFin: string;
  recinto: string;
  ciudad: string;
  departamento: string;
  estadoVenta: ConcertEstadoVenta;
  precioMinimo: number | null;
  moneda: string;
  destacado: boolean;
  artistas: Array<{
    id: string;
    nombre: string;
    artistaId: string | null;
    avatarUrl?: string | null;
  }>;
};

export type ConcertQuery = {
  q?: string;
  ciudad?: string;
  genero?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  artistaId?: string;
  destacados?: boolean;
  page?: number;
  limit?: number;
  sort?: 'fecha_asc' | 'fecha_desc' | 'recientes';
};

export type ConcertsResponse = {
  items: PublicConcertSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export type CreateConcertPayload = {
  titulo: string;
  descripcion?: string;
  genero?: string;
  fechaInicio: string;
  fechaFin: string;
  zonaHoraria?: string;
  recinto: string;
  direccion: string;
  ciudad: string;
  departamento: string;
  inicioVenta?: string | null;
  destacado?: boolean;
};

export type UpdateConcertPayload = Partial<CreateConcertPayload>;

export type CreateTicketCategoryPayload = {
  nombre: string;
  precio: number;
  moneda?: string;
  cupoTotal: number;
  disponible?: boolean;
};

export type UpdateTicketCategoryPayload = Partial<CreateTicketCategoryPayload>;

export type AddConcertArtistPayload = {
  artistaId?: string | null;
  nombreArtista: string;
  orden?: number;
};

export type CancelarConciertoPayload = {
  motivo: string;
};

export type InformacionCancelacionConcierto = {
  conciertoId: string;
  titulo: string;
  estado: ConcertEstado;
  motivoCancelacion: string;
  canceladoEn: string;
  canceladoPorNombre?: string;
  totalTicketsAfectados: number;
  totalOrdenesAfectadas: number;
  totalMontoAfectadoBob: number;
  pagosPrueba: boolean;
};

// CU19 — Recomendaciones de Conciertos
export type RecommendedConcertItem = Concert & {
  score: number;
  motivosRecomendacion: string[];
  esPersonalizada: boolean;
};

export type RecommendedConcertsResponse = {
  items: RecommendedConcertItem[];
  total: number;
  esPersonalizada: boolean;
};
