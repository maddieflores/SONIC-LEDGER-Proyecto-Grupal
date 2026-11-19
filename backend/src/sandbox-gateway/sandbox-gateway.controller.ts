import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import {
  CreatePaymentIntentDto,
  CreateRefundIntentDto,
  TriggerWebhookDto,
} from './sandbox-gateway.dto.js';
import { SandboxGatewayService } from './sandbox-gateway.service.js';

@Controller('sandbox-gateway')
export class SandboxGatewayController {
  constructor(private readonly sandboxService: SandboxGatewayService) {}

  @Get('status')
  getStatus() {
    return this.sandboxService.getStatus();
  }

  @Post('payments')
  @HttpCode(HttpStatus.CREATED)
  createPaymentIntent(
    @Body() dto: CreatePaymentIntentDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    if (apiKey && apiKey !== this.sandboxService.API_KEY) {
      throw new BadRequestException('API key de sandbox inválida.');
    }

    const session = this.sandboxService.createPaymentSession(
      dto.orderId,
      dto.amount,
      dto.currency || 'BOB',
      dto.simulatedStatus,
    );

    return {
      success: true,
      session,
      message: 'Sesión de pago iniciada en Sandbox de prueba.',
    };
  }

  @Get('payments/:id')
  getPaymentIntent(@Param('id') id: string) {
    const session = this.sandboxService.getPaymentSession(id);
    if (!session) {
      throw new NotFoundException('Sesión de pago no encontrada en Sandbox.');
    }
    return { success: true, session };
  }

  @Post('refunds')
  @HttpCode(HttpStatus.CREATED)
  createRefundIntent(
    @Body() dto: CreateRefundIntentDto,
    @Headers('x-api-key') apiKey?: string,
  ) {
    if (apiKey && apiKey !== this.sandboxService.API_KEY) {
      throw new BadRequestException('API key de sandbox inválida.');
    }

    const session = this.sandboxService.createRefundSession(
      dto.orderId,
      dto.amount,
      dto.reason,
      'BOB',
      dto.simulatedStatus,
    );

    return {
      success: true,
      session,
      message: 'Solicitud de reembolso registrada en Sandbox de prueba.',
    };
  }

  @Get('refunds/:id')
  getRefundIntent(@Param('id') id: string) {
    const session = this.sandboxService.getRefundSession(id);
    if (!session) {
      throw new NotFoundException(
        'Solicitud de reembolso no encontrada en Sandbox.',
      );
    }
    return { success: true, session };
  }

  @Post('simulate/trigger-webhook')
  async triggerWebhook(@Body() dto: TriggerWebhookDto) {
    const built = this.sandboxService.buildWebhookPayload(
      dto.event,
      {
        orderId: dto.orderId,
        amount: dto.amount,
        transactionId: dto.transactionId,
        refundId: dto.refundId,
        reason: dto.reason,
      },
      dto.customSecret,
    );

    try {
      const response = await fetch(dto.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sandbox-Signature': built.signature,
          'X-Sandbox-Event-Id': built.eventId,
          'X-Sandbox-Timestamp': built.timestamp,
        },
        body: built.rawPayload,
      });

      const responseBody = await response.json().catch(() => null);

      return {
        success: response.ok,
        httpStatus: response.status,
        deliveredPayload: built.body,
        responseFromTarget: responseBody,
        signature: built.signature,
      };
    } catch (e) {
      return {
        success: false,
        error: (e as Error).message,
        payloadPrepared: built.body,
      };
    }
  }
}
