export type OrdenEstado =
  | 'PENDIENTE'
  | 'CONFIRMADA'
  | 'EXPIRADA'
  | 'CANCELADA'
  | 'FALLIDA';

export type ReembolsoEstado =
  | 'NINGUNO'
  | 'PENDIENTE_REEMBOLSO'
  | 'REEMBOLSADO'
  | 'REEMBOLSO_PARCIAL';

export type ReembolsoTipo = 'TOTAL' | 'PARCIAL';

export type ReembolsoEstadoOperacion =
  | 'PENDIENTE'
  | 'EN_PROCESO'
  | 'COMPLETADO'
  | 'FALLIDO';

export type ReembolsoItem = {
  id: string;
  ordenId: string;
  conciertoId: string;
  reembolsoTransaccionId: string;
  monto: number;
  moneda: string;
  tipo: ReembolsoTipo;
  estado: ReembolsoEstadoOperacion;
  motivo: string;
  procesadoEn: string | null;
  mensajeResultado: string | null;
  idempotencyKey?: string | null;
  createdAt: string;
};

export type TicketEstado = 'VIGENTE' | 'UTILIZADO' | 'INVALIDADO';

export type ValidacionResultado =
  | 'EXITOSO'
  | 'YA_UTILIZADO'
  | 'EVENTO_INCORRECTO'
  | 'INVALIDADO'
  | 'NO_ENCONTRADO'
  | 'NO_AUTORIZADO';

export type OrdenCompraItem = {
  id: string;
  categoriaId: string;
  categoriaNombre: string;
  cantidad: number;
  precioUnitario: number;
  subtotal: number;
};

export type OrdenCompra = {
  id: string;
  usuarioId: string;
  conciertoId: string;
  conciertoTitulo: string;
  conciertoPortadaUrl?: string | null;
  estado: OrdenEstado;
  total: number;
  moneda: string;
  expiraEn: string;
  operacionId: string;
  proveedorPago: string | null;
  pagoTransaccionId: string | null;
  pagoEstado: string | null;
  confirmadaEn: string | null;
  reembolsoEstado?: ReembolsoEstado;
  montoReembolsado?: number;
  reembolsos?: ReembolsoItem[];
  items: OrdenCompraItem[];
  createdAt: string;
};

export type TicketDigital = {
  id: string;
  ordenId: string;
  conciertoId: string;
  conciertoTitulo: string;
  conciertoPortadaUrl: string | null;
  fechaInicio: string;
  recinto: string;
  ciudad: string;
  categoriaId: string;
  categoriaNombre: string;
  precio: number;
  moneda: string;
  estado: TicketEstado;
  codigoPublico: string;
  qrToken: string;
  qrCodeDataUrl?: string;
  fechaEmision: string;
  fechaUtilizado: string | null;
  motivoInvalidacion?: string | null;
  conciertoCancelado?: boolean;
  motivoCancelacion?: string | null;
  reembolsoEstado?: ReembolsoEstado;
};

export type CrearOrdenPayload = {
  conciertoId: string;
  categoriaId: string;
  cantidad: number;
  operacionId?: string;
};

export type ProcesarPagoPayload = {
  ordenId: string;
  simularResultado?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
};

export type ValidarQRPayload = {
  conciertoId: string;
  qrToken: string;
};

export type ResultadoValidacion = {
  valido: boolean;
  resultado: ValidacionResultado;
  mensaje: string;
  ticket?: {
    codigoPublico: string;
    categoriaNombre: string;
    conciertoTitulo: string;
    fechaEmision: string;
    fechaUtilizado?: string | null;
  };
};

export type AsignarVerificadorPayload = {
  usuarioId: string;
};

export type VerificadorItem = {
  id: string;
  usuarioId: string;
  username: string;
  email: string;
  displayName: string | null;
  activo: boolean;
  createdAt: string;
};

export type ConciertoAsignadoVerificador = {
  conciertoId: string;
  titulo: string;
  recinto: string;
  ciudad: string;
  fechaInicio: string;
  portadaUrl: string | null;
  totalTicketsEmitidos?: number;
  totalTicketsValidados?: number;
};

// 5. Estadísticas de Ventas y Asistencia (CU24)
export type EstadisticasCategoriaItem = {
  categoriaId: string;
  nombre: string;
  precio: number;
  moneda: string;
  cupoTotal: number;
  cupoDisponible: number;
  entradasVendidas: number;
  reservasActivas: number;
  ingresosConfirmadosBob: number;
  ticketsUtilizados: number;
  ticketsPendientes: number;
  ticketsInvalidados: number;
  porcentajeAsistencia: number;
};

export type EstadisticasConcierto = {
  conciertoId: string;
  titulo: string;
  estado: 'BORRADOR' | 'PUBLICADO' | 'CANCELADO';
  estadoVenta: string;
  fechaInicio: string;
  recinto: string;
  ciudad: string;
  // Cupos y ocupación
  cupoTotal: number;
  entradasVendidas: number;
  reservasActivas: number;
  cuposDisponibles: number;
  porcentajeOcupacion: number;
  // Órdenes
  totalOrdenes: number;
  ordenesConfirmadas: number;
  ordenesPendientes: number;
  ordenesFallidasOExpiradas: number;
  // Ingresos
  ingresosConfirmadosBob: number;
  pagosPrueba: boolean;
  // Asistencia
  ticketsEmitidos: number;
  ticketsUtilizados: number;
  ticketsPendientesIngreso: number;
  ticketsInvalidados: number;
  tasaAsistenciaPorcentaje: number;
  // Desglose por categoría
  categorias: EstadisticasCategoriaItem[];
  // Cancelación y Reembolsos
  esCancelado: boolean;
  canceladoEn?: string | null;
  motivoCancelacion?: string | null;
  ordenesPendienteReembolso: number;
  montoPendienteReembolsoBob: number;
  ordenesReembolsadas?: number;
  montoReembolsadoBob?: number;
  ingresosNetosBob?: number;
};

export type SolicitarReembolsoPayload = {
  ordenId: string;
  monto?: number;
  motivo: string;
  tipo?: ReembolsoTipo;
  idempotencyKey?: string;
};

export type ProcesarReembolsoSimuladoPayload = {
  reembolsoId: string;
  accion: 'COMPLETAR' | 'FALLAR';
  mensaje?: string;
};

export type ResumenReembolsosOrganizador = {
  conciertoId: string;
  totalSolicitudes: number;
  pendientes: number;
  completados: number;
  fallidos: number;
  montoPendienteBob: number;
  montoCompletadoBob: number;
  montoFallidoBob: number;
  reembolsos: ReembolsoItem[];
};

export type ResumenEstadisticasItem = {
  conciertoId: string;
  titulo: string;
  estado: string;
  fechaInicio: string;
  ciudad: string;
  cupoTotal: number;
  entradasVendidas: number;
  cupoDisponible: number;
  ingresosBob: number;
  ticketsUtilizados: number;
  tasaAsistencia: number;
  porcentajeOcupacion: number;
};

export type ResumenEstadisticasOrganizador = {
  totalConciertos: number;
  conciertosPublicados: number;
  conciertosCancelados: number;
  conciertosBorrador: number;
  totalCupos: number;
  totalEntradasVendidas: number;
  totalIngresosBob: number;
  totalTicketsUtilizados: number;
  tasaAsistenciaPromedio: number;
  pagosPrueba: boolean;
  conciertos: ResumenEstadisticasItem[];
};
