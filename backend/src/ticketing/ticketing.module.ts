import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdenCompra } from './orden-compra.entity.js';
import { OrdenItem } from './orden-item.entity.js';
import { ReservaCupo } from './reserva-cupo.entity.js';
import { Ticket } from './ticket.entity.js';
import { ConciertoVerificador } from './concierto-verificador.entity.js';
import { TicketValidacion } from './ticket-validacion.entity.js';
import { Reembolso } from './reembolso.entity.js';
import { Concierto } from '../conciertos/concierto.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { Usuario } from '../auth/usuario.entity.js';
import { MockPaymentProvider } from './mock-payment.provider.js';
import { TicketingService } from './ticketing.service.js';
import { EstadisticasService } from './estadisticas.service.js';
import { TicketingController } from './ticketing.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { SandboxGatewayModule } from '../sandbox-gateway/sandbox-gateway.module.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      OrdenCompra,
      OrdenItem,
      ReservaCupo,
      Ticket,
      ConciertoVerificador,
      TicketValidacion,
      Reembolso,
      Concierto,
      ConciertoCategoria,
      Usuario,
    ]),
    AuthModule,
    SandboxGatewayModule,
  ],
  controllers: [TicketingController],
  providers: [TicketingService, EstadisticasService, MockPaymentProvider],
  exports: [TicketingService, EstadisticasService, MockPaymentProvider],
})
export class TicketingModule {}
