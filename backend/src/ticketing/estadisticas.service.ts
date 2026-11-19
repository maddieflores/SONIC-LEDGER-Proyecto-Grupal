import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Concierto, ConciertoEstado } from '../conciertos/concierto.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { OrdenCompra, OrdenEstado, ReembolsoEstado } from './orden-compra.entity.js';
import { Ticket, TicketEstado } from './ticket.entity.js';
import { ReservaCupo } from './reserva-cupo.entity.js';
import { RolNombre } from '../auth/rol.entity.js';

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
  cupoTotal: number;
  entradasVendidas: number;
  reservasActivas: number;
  cuposDisponibles: number;
  porcentajeOcupacion: number;
  totalOrdenes: number;
  ordenesConfirmadas: number;
  ordenesPendientes: number;
  ordenesFallidasOExpiradas: number;
  ingresosConfirmadosBob: number;
  pagosPrueba: boolean;
  ticketsEmitidos: number;
  ticketsUtilizados: number;
  ticketsPendientesIngreso: number;
  ticketsInvalidados: number;
  tasaAsistenciaPorcentaje: number;
  categorias: EstadisticasCategoriaItem[];
  esCancelado: boolean;
  canceladoEn?: string | null;
  motivoCancelacion?: string | null;
  ordenesPendienteReembolso: number;
  montoPendienteReembolsoBob: number;
  ordenesReembolsadas?: number;
  montoReembolsadoBob?: number;
  ingresosNetosBob?: number;
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

@Injectable()
export class EstadisticasService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(Concierto)
    private readonly conciertosRepo: Repository<Concierto>,
    @InjectRepository(ConciertoCategoria)
    private readonly categoriasRepo: Repository<ConciertoCategoria>,
    @InjectRepository(OrdenCompra)
    private readonly ordenesRepo: Repository<OrdenCompra>,
    @InjectRepository(Ticket)
    private readonly ticketsRepo: Repository<Ticket>,
    @InjectRepository(ReservaCupo)
    private readonly reservasRepo: Repository<ReservaCupo>,
  ) {}

  /**
   * CU24 — Consultar estadísticas detalladas de ventas y asistencia de un concierto
   */
  async obtenerEstadisticasConcierto(
    userId: string,
    conciertoId: string,
    roles: string[] = [],
  ): Promise<EstadisticasConcierto> {
    const concierto = await this.conciertosRepo.findOne({
      where: { id: conciertoId },
      relations: { categorias: true, organizador: true },
    });

    if (!concierto) {
      throw new NotFoundException('Concierto no encontrado.');
    }

    const isOwner = concierto.organizadorId === userId;
    const isAdmin = roles.includes(RolNombre.ADMIN);
    if (!isOwner && !isAdmin) {
      throw new ForbiddenException(
        'No tienes permiso para consultar las estadísticas privadas de este concierto.',
      );
    }

    // 1. Métricas de categorías y cupos
    const categorias = concierto.categorias || [];
    const cupoTotal = categorias.reduce((sum, c) => sum + (c.cupoTotal || 0), 0);
    const cuposDisponibles = categorias.reduce(
      (sum, c) => sum + (c.cupoDisponible || 0),
      0,
    );

    // 2. Reservas temporales activas (no expiradas ni confirmadas ni liberadas)
    const reservasActivasRaw = await this.dataSource.query(
      `
      SELECT COALESCE(SUM(r.cantidad), 0)::int as total
      FROM reservas_cupo r
      JOIN concierto_categorias cc ON cc.id = r.categoria_id
      WHERE cc.concierto_id = $1
        AND r.liberada = false
        AND r.confirmada = false
        AND r.expira_en > NOW()
    `,
      [conciertoId],
    );
    const reservasActivas = Number(reservasActivasRaw[0]?.total || 0);

    // 3. Órdenes por estado e ingresos confirmados
    const ordenesStatsRaw = await this.dataSource.query(
      `
      SELECT
        estado,
        COUNT(*)::int as cantidad_ordenes,
        COALESCE(SUM(total), 0)::numeric as total_bob
      FROM ordenes_compra
      WHERE concierto_id = $1
      GROUP BY estado
    `,
      [conciertoId],
    );

    let ordenesConfirmadas = 0;
    let ordenesPendientes = 0;
    let ordenesFallidasOExpiradas = 0;
    let ingresosConfirmadosBob = 0;
    let totalOrdenes = 0;

    for (const row of ordenesStatsRaw) {
      const cant = Number(row.cantidad_ordenes || 0);
      totalOrdenes += cant;
      if (row.estado === OrdenEstado.CONFIRMADA) {
        ordenesConfirmadas += cant;
        ingresosConfirmadosBob += Number(row.total_bob || 0);
      } else if (row.estado === OrdenEstado.PENDIENTE) {
        ordenesPendientes += cant;
      } else {
        ordenesFallidasOExpiradas += cant;
      }
    }

    // 4. Conteo de tickets por estado
    const ticketsStatsRaw = await this.dataSource.query(
      `
      SELECT
        estado,
        COUNT(*)::int as cantidad
      FROM tickets
      WHERE concierto_id = $1
      GROUP BY estado
    `,
      [conciertoId],
    );

    let ticketsUtilizados = 0;
    let ticketsPendientesIngreso = 0;
    let ticketsInvalidados = 0;
    let ticketsEmitidos = 0;

    for (const row of ticketsStatsRaw) {
      const cant = Number(row.cantidad || 0);
      ticketsEmitidos += cant;
      if (row.estado === TicketEstado.UTILIZADO) {
        ticketsUtilizados += cant;
      } else if (row.estado === TicketEstado.VIGENTE) {
        ticketsPendientesIngreso += cant;
      } else if (row.estado === TicketEstado.INVALIDADO) {
        ticketsInvalidados += cant;
      }
    }

    const entradasVendidas = ticketsEmitidos;

    // Fórmulas de indicadores:
    // Tasa de asistencia = (tickets utilizados / tickets válidos emitidos) * 100
    const ticketsValidos = ticketsUtilizados + ticketsPendientesIngreso;
    const tasaAsistenciaPorcentaje =
      ticketsValidos > 0
        ? Number(((ticketsUtilizados / ticketsValidos) * 100).toFixed(1))
        : ticketsEmitidos > 0
          ? Number(((ticketsUtilizados / ticketsEmitidos) * 100).toFixed(1))
          : 0;

    // Porcentaje de ocupación vendida = (entradas vendidas / cupo total) * 100
    const porcentajeOcupacion =
      cupoTotal > 0
        ? Number(((entradasVendidas / cupoTotal) * 100).toFixed(1))
        : 0;

    // 5. Reembolsos pendientes (si aplica por cancelación) y completados
    const reembolsosRaw = await this.dataSource.query(
      `
      SELECT
        COUNT(*)::int as cantidad,
        COALESCE(SUM(total), 0)::numeric as total_bob
      FROM ordenes_compra
      WHERE concierto_id = $1
        AND reembolso_estado = $2
    `,
      [conciertoId, ReembolsoEstado.PENDIENTE_REEMBOLSO],
    );
    const ordenesPendienteReembolso = Number(reembolsosRaw[0]?.cantidad || 0);
    const montoPendienteReembolsoBob = Number(reembolsosRaw[0]?.total_bob || 0);

    const reembolsosCompletadosRaw = await this.dataSource.query(
      `
      SELECT
        COUNT(*)::int as cantidad,
        COALESCE(SUM(monto_reembolsado), 0)::numeric as total_bob
      FROM ordenes_compra
      WHERE concierto_id = $1
        AND (reembolso_estado = $2 OR reembolso_estado = $3 OR monto_reembolsado > 0)
    `,
      [
        conciertoId,
        ReembolsoEstado.REEMBOLSADO,
        ReembolsoEstado.REEMBOLSO_PARCIAL,
      ],
    );
    const ordenesReembolsadas = Number(
      reembolsosCompletadosRaw[0]?.cantidad || 0,
    );
    const montoReembolsadoBob = Number(
      reembolsosCompletadosRaw[0]?.total_bob || 0,
    );
    const ingresosNetosBob = Math.max(
      0,
      ingresosConfirmadosBob - montoReembolsadoBob,
    );

    // 6. Desglose detallado por categoría con agregación en PostgreSQL
    const catBreakdownRaw = await this.dataSource.query(
      `
      SELECT
        cc.id as categoria_id,
        cc.nombre,
        cc.precio::numeric,
        cc.moneda,
        cc.cupo_total::int,
        cc.cupo_disponible::int,
        COUNT(t.id)::int as entradas_vendidas,
        COUNT(CASE WHEN t.estado = 'UTILIZADO' THEN 1 END)::int as tickets_utilizados,
        COUNT(CASE WHEN t.estado = 'VIGENTE' THEN 1 END)::int as tickets_pendientes,
        COUNT(CASE WHEN t.estado = 'INVALIDADO' THEN 1 END)::int as tickets_invalidados
      FROM concierto_categorias cc
      LEFT JOIN tickets t ON t.categoria_id = cc.id
      WHERE cc.concierto_id = $1
      GROUP BY cc.id, cc.nombre, cc.precio, cc.moneda, cc.cupo_total, cc.cupo_disponible
      ORDER BY cc.precio DESC
    `,
      [conciertoId],
    );

    // Consultar reservas activas por categoría
    const catReservasRaw = await this.dataSource.query(
      `
      SELECT
        categoria_id,
        COALESCE(SUM(cantidad), 0)::int as reservas
      FROM reservas_cupo
      WHERE categoria_id IN (SELECT id FROM concierto_categorias WHERE concierto_id = $1)
        AND liberada = false
        AND confirmada = false
        AND expira_en > NOW()
      GROUP BY categoria_id
    `,
      [conciertoId],
    );
    const catReservasMap = new Map<string, number>();
    for (const cr of catReservasRaw) {
      catReservasMap.set(cr.categoria_id, Number(cr.reservas || 0));
    }

    const categoriasStats: EstadisticasCategoriaItem[] = catBreakdownRaw.map(
      (catRow: any) => {
        const cTotal = Number(catRow.entradas_vendidas || 0);
        const cUtilizados = Number(catRow.tickets_utilizados || 0);
        const cPendientes = Number(catRow.tickets_pendientes || 0);
        const cInvalidados = Number(catRow.tickets_invalidados || 0);
        const cValidos = cUtilizados + cPendientes;
        const cAsistencia =
          cValidos > 0
            ? Number(((cUtilizados / cValidos) * 100).toFixed(1))
            : 0;

        const precio = Number(catRow.precio || 0);
        const ingresosCat = Number((cTotal * precio).toFixed(2));

        return {
          categoriaId: catRow.categoria_id,
          nombre: catRow.nombre,
          precio,
          moneda: catRow.moneda || 'BOB',
          cupoTotal: Number(catRow.cupo_total || 0),
          cupoDisponible: Number(catRow.cupo_disponible || 0),
          entradasVendidas: cTotal,
          reservasActivas: catReservasMap.get(catRow.categoria_id) || 0,
          ingresosConfirmadosBob: ingresosCat,
          ticketsUtilizados: cUtilizados,
          ticketsPendientes: cPendientes,
          ticketsInvalidados: cInvalidados,
          porcentajeAsistencia: cAsistencia,
        };
      },
    );

    return {
      conciertoId: concierto.id,
      titulo: concierto.titulo,
      estado: concierto.estado,
      estadoVenta: concierto.estado,
      fechaInicio:
        concierto.fechaInicio instanceof Date
          ? concierto.fechaInicio.toISOString()
          : String(concierto.fechaInicio),
      recinto: concierto.recinto,
      ciudad: concierto.ciudad,
      cupoTotal,
      entradasVendidas,
      reservasActivas,
      cuposDisponibles,
      porcentajeOcupacion,
      totalOrdenes,
      ordenesConfirmadas,
      ordenesPendientes,
      ordenesFallidasOExpiradas,
      ingresosConfirmadosBob: Number(ingresosConfirmadosBob.toFixed(2)),
      pagosPrueba: true, // Indicador de pagos de prueba simulados
      ticketsEmitidos,
      ticketsUtilizados,
      ticketsPendientesIngreso,
      ticketsInvalidados,
      tasaAsistenciaPorcentaje,
      categorias: categoriasStats,
      esCancelado: concierto.estado === ConciertoEstado.CANCELADO,
      canceladoEn: concierto.canceladoEn ? concierto.canceladoEn.toISOString() : null,
      motivoCancelacion: concierto.motivoCancelacion || null,
      ordenesPendienteReembolso,
      montoPendienteReembolsoBob: Number(montoPendienteReembolsoBob.toFixed(2)),
      ordenesReembolsadas,
      montoReembolsadoBob: Number(montoReembolsadoBob.toFixed(2)),
      ingresosNetosBob: Number(ingresosNetosBob.toFixed(2)),
    };
  }

  /**
   * CU24 — Resumen general de ventas y asistencia para el dashboard del organizador
   */
  async obtenerResumenOrganizador(
    organizadorId: string,
  ): Promise<ResumenEstadisticasOrganizador> {
    const conciertos = await this.conciertosRepo.find({
      where: { organizadorId },
      relations: { categorias: true },
      order: { createdAt: 'DESC' },
    });

    let totalCupos = 0;
    let totalEntradasVendidas = 0;
    let totalIngresosBob = 0;
    let totalTicketsUtilizados = 0;
    let totalTicketsValidos = 0;

    let conciertosPublicados = 0;
    let conciertosCancelados = 0;
    let conciertosBorrador = 0;

    const items: ResumenEstadisticasItem[] = [];

    for (const c of conciertos) {
      if (c.estado === ConciertoEstado.PUBLICADO) conciertosPublicados++;
      else if (c.estado === ConciertoEstado.CANCELADO) conciertosCancelados++;
      else if (c.estado === ConciertoEstado.BORRADOR) conciertosBorrador++;

      const cCupoTotal = (c.categorias || []).reduce(
        (acc, cat) => acc + (cat.cupoTotal || 0),
        0,
      );
      const cCupoDisp = (c.categorias || []).reduce(
        (acc, cat) => acc + (cat.cupoDisponible || 0),
        0,
      );

      // Conteo de tickets y órdenes
      const [ticketsCount, ticketsUtilizadosCount, ordenesConfirmadas] =
        await Promise.all([
          this.ticketsRepo.count({ where: { conciertoId: c.id } }),
          this.ticketsRepo.count({
            where: { conciertoId: c.id, estado: TicketEstado.UTILIZADO },
          }),
          this.ordenesRepo.find({
            where: { conciertoId: c.id, estado: OrdenEstado.CONFIRMADA },
          }),
        ]);

      const cIngresos = ordenesConfirmadas.reduce(
        (acc, o) => acc + Number(o.total || 0),
        0,
      );

      const cAsistencia =
        ticketsCount > 0
          ? Number(((ticketsUtilizadosCount / ticketsCount) * 100).toFixed(1))
          : 0;

      const cOcupacion =
        cCupoTotal > 0
          ? Number(((ticketsCount / cCupoTotal) * 100).toFixed(1))
          : 0;

      totalCupos += cCupoTotal;
      totalEntradasVendidas += ticketsCount;
      totalIngresosBob += cIngresos;
      totalTicketsUtilizados += ticketsUtilizadosCount;
      totalTicketsValidos += ticketsCount;

      items.push({
        conciertoId: c.id,
        titulo: c.titulo,
        estado: c.estado,
        fechaInicio:
          c.fechaInicio instanceof Date
            ? c.fechaInicio.toISOString()
            : String(c.fechaInicio),
        ciudad: c.ciudad,
        cupoTotal: cCupoTotal,
        entradasVendidas: ticketsCount,
        cupoDisponible: cCupoDisp,
        ingresosBob: Number(cIngresos.toFixed(2)),
        ticketsUtilizados: ticketsUtilizadosCount,
        tasaAsistencia: cAsistencia,
        porcentajeOcupacion: cOcupacion,
      });
    }

    const tasaAsistenciaPromedio =
      totalTicketsValidos > 0
        ? Number(((totalTicketsUtilizados / totalTicketsValidos) * 100).toFixed(1))
        : 0;

    return {
      totalConciertos: conciertos.length,
      conciertosPublicados,
      conciertosCancelados,
      conciertosBorrador,
      totalCupos,
      totalEntradasVendidas,
      totalIngresosBob: Number(totalIngresosBob.toFixed(2)),
      totalTicketsUtilizados,
      tasaAsistenciaPromedio,
      pagosPrueba: true,
      conciertos: items,
    };
  }
}
