import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { TicketingService } from './ticketing.service.js';
import { EstadisticasService } from './estadisticas.service.js';
import {
  AssignVerifierDto,
  CreateOrderDto,
  ProcessPaymentDto,
  ProcesarReembolsoSimuladoDto,
  SolicitarReembolsoDto,
  ValidateQrDto,
} from './ticketing.dto.js';
import { JwtGuard } from '../auth/auth.controller.js';
import { RolesGuard } from '../auth/roles.guard.js';
import { Roles } from '../auth/roles.decorator.js';
import { RolNombre } from '../auth/rol.entity.js';

type AuthRequest = Request & {
  user?: { id: string; username: string; email: string; roles: string[] };
};

@Controller('ticketing')
export class TicketingController {
  constructor(
    private readonly ticketingService: TicketingService,
    private readonly estadisticasService: EstadisticasService,
  ) {}

  // 1. Órdenes y Compras (CU20)
  @Post('ordenes')
  @UseGuards(JwtGuard)
  async crearOrden(
    @Req() req: AuthRequest,
    @Body() dto: CreateOrderDto,
  ) {
    return this.ticketingService.crearReservaOrden(req.user!.id, dto);
  }

  @Get('ordenes/:id')
  @UseGuards(JwtGuard)
  async obtenerOrden(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.ticketingService.obtenerOrden(req.user!.id, id);
  }

  @Post('pagos/simular')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.OK)
  async procesarPago(
    @Req() req: AuthRequest,
    @Body() dto: ProcessPaymentDto,
  ) {
    return this.ticketingService.procesarPago(req.user!.id, dto);
  }

  // 2. Mis Entradas (CU21)
  @Get('mis-tickets')
  @UseGuards(JwtGuard)
  async listarMisTickets(@Req() req: AuthRequest) {
    return this.ticketingService.listarMisTickets(req.user!.id);
  }

  @Get('tickets/:id')
  @UseGuards(JwtGuard)
  async obtenerDetalleTicket(
    @Req() req: AuthRequest,
    @Param('id') id: string,
  ) {
    return this.ticketingService.obtenerDetalleTicket(req.user!.id, id);
  }

  // 3. Validación de Ingreso (CU22)
  @Post('validar-qr')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.VERIFICADOR, RolNombre.ADMIN)
  @HttpCode(HttpStatus.OK)
  async validarQr(
    @Req() req: AuthRequest,
    @Body() dto: ValidateQrDto,
  ) {
    return this.ticketingService.validarIngresoQR(req.user!.id, dto);
  }

  @Get('verificador/conciertos')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.VERIFICADOR, RolNombre.ADMIN)
  async listarConciertosAsignados(@Req() req: AuthRequest) {
    return this.ticketingService.listarConciertosAsignadosVerificador(req.user!.id);
  }

  // 4. Gestión de Verificadores por el Organizador
  @Get('conciertos/:id/verificadores')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async listarVerificadores(
    @Req() req: AuthRequest,
    @Param('id') conciertoId: string,
  ) {
    return this.ticketingService.listarVerificadoresConcierto(
      req.user!.id,
      conciertoId,
    );
  }

  @Post('conciertos/:id/verificadores')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async asignarVerificador(
    @Req() req: AuthRequest,
    @Param('id') conciertoId: string,
    @Body() dto: AssignVerifierDto,
  ) {
    return this.ticketingService.asignarVerificador(
      req.user!.id,
      conciertoId,
      dto,
    );
  }

  @Delete('conciertos/:id/verificadores/:verificadorId')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async removerVerificador(
    @Req() req: AuthRequest,
    @Param('id') conciertoId: string,
    @Param('verificadorId') verificadorId: string,
  ) {
    return this.ticketingService.removerVerificador(
      req.user!.id,
      conciertoId,
      verificadorId,
    );
  }

  @Get('verificadores-disponibles')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async listarVerificadoresDisponibles() {
    return this.ticketingService.listarCuentasVerificadoresDisponibles();
  }

  // 5. Estadísticas de Ventas y Asistencia (CU24)
  @Get('organizador/conciertos/:id/estadisticas')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async obtenerEstadisticasConcierto(
    @Req() req: AuthRequest,
    @Param('id') conciertoId: string,
  ) {
    return this.estadisticasService.obtenerEstadisticasConcierto(
      req.user!.id,
      conciertoId,
      req.user!.roles,
    );
  }

  @Get('organizador/estadisticas/resumen')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async obtenerResumenEstadisticas(@Req() req: AuthRequest) {
    return this.estadisticasService.obtenerResumenOrganizador(req.user!.id);
  }

  // 6. Devoluciones / Reembolsos
  @Post('reembolsos')
  @UseGuards(JwtGuard)
  @HttpCode(HttpStatus.CREATED)
  async solicitarReembolso(
    @Req() req: AuthRequest,
    @Body() dto: SolicitarReembolsoDto,
  ) {
    return this.ticketingService.solicitarReembolso(
      req.user!.id,
      dto,
      req.user!.roles,
    );
  }

  @Get('ordenes/:id/reembolsos')
  @UseGuards(JwtGuard)
  async obtenerReembolsosOrden(
    @Req() req: AuthRequest,
    @Param('id') ordenId: string,
  ) {
    return this.ticketingService.obtenerReembolsosOrden(
      req.user!.id,
      ordenId,
      req.user!.roles,
    );
  }

  @Post('reembolsos/:id/reintentar')
  @UseGuards(JwtGuard)
  async reintentarReembolso(
    @Req() req: AuthRequest,
    @Param('id') reembolsoId: string,
  ) {
    return this.ticketingService.reintentarReembolso(
      reembolsoId,
      req.user!.id,
      req.user!.roles,
    );
  }

  @Get('organizador/conciertos/:id/reembolsos')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async obtenerReembolsosOrganizador(
    @Req() req: AuthRequest,
    @Param('id') conciertoId: string,
  ) {
    return this.ticketingService.obtenerReembolsosOrganizador(
      req.user!.id,
      conciertoId,
      req.user!.roles,
    );
  }

  @Post('sandbox/procesar-reembolso')
  @UseGuards(JwtGuard, RolesGuard)
  @Roles(RolNombre.ORGANIZADOR, RolNombre.ADMIN)
  async procesarReembolsoSimulado(
    @Body() dto: ProcesarReembolsoSimuladoDto,
  ) {
    return this.ticketingService.procesarReembolso(
      dto.reembolsoId,
      dto.accion,
      dto.mensaje,
    );
  }

  // 7. Webhook de recepción del simulador Sandbox
  @Post('webhooks/sandbox')
  @HttpCode(HttpStatus.OK)
  async recibirWebhookSandbox(
    @Req() req: Request,
    @Headers('x-sandbox-signature') signature?: string,
  ) {
    const rawBody =
      typeof req.body === 'string'
        ? req.body
        : JSON.stringify(req.body);
    return this.ticketingService.procesarWebhookSandbox(
      rawBody,
      signature || '',
    );
  }
}
