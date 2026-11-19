import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export interface SandboxPaymentSession {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | 'EXPIRADO';
  merchantId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SandboxRefundSession {
  refundId: string;
  orderId: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'PENDIENTE' | 'EN_PROCESO' | 'COMPLETADO' | 'FALLIDO';
  merchantId: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SandboxGatewayService {
  private readonly logger = new Logger(SandboxGatewayService.name);

  // Almacenamiento en memoria para sesiones del simulador (solo pruebas / desarrollo)
  private readonly paymentSessions = new Map<string, SandboxPaymentSession>();
  private readonly refundSessions = new Map<string, SandboxRefundSession>();

  /**
   * Obtiene el identificador de comercio desde variables de entorno privadas.
   */
  get MERCHANT_ID(): string {
    return process.env.SANDBOX_MERCHANT_ID || 'SONIC_LEDGER_LOCAL_SANDBOX';
  }

  /**
   * Obtiene la API Key del sandbox desde variables de entorno privadas.
   * Falla de forma segura si no está configurada.
   */
  get API_KEY(): string {
    return process.env.SANDBOX_API_KEY || '';
  }

  /**
   * Obtiene el secreto de webhook desde variables de entorno privadas.
   * Falla de forma segura si no está configurado.
   */
  get WEBHOOK_SECRET(): string {
    return process.env.SANDBOX_WEBHOOK_SECRET || '';
  }

  /**
   * Valida estrictamente que el simulador solo pueda operar en entornos de desarrollo o pruebas,
   * y que cuente con las credenciales necesarias configuradas en variables de entorno.
   */
  public assertSimulatorAllowed(): void {
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      throw new ForbiddenException(
        'El simulador Sandbox está estrictamente deshabilitado en entornos de producción.',
      );
    }

    const enabled = process.env.SANDBOX_GATEWAY_ENABLED;
    if (enabled !== undefined && enabled.toLowerCase() === 'false') {
      throw new ForbiddenException(
        'El simulador Sandbox ha sido deshabilitado mediante configuración de entorno.',
      );
    }

    if (!this.API_KEY || !this.WEBHOOK_SECRET) {
      throw new ForbiddenException(
        'El simulador Sandbox no está configurado adecuadamente. Faltan variables de entorno requeridas.',
      );
    }
  }

  getStatus() {
    this.assertSimulatorAllowed();
    return {
      habilitado: true,
      entorno: process.env.NODE_ENV || 'development',
      comercioId: this.MERCHANT_ID,
      aviso: 'MODO DEMOSTRACIÓN — PASARELA SANDBOX FICTICIA (SIN DINERO REAL)',
      sesionesPagosActivas: this.paymentSessions.size,
      sesionesReembolsosActivas: this.refundSessions.size,
    };
  }

  // 1. Crear sesión de pago en el simulador
  createPaymentSession(
    orderId: string,
    amount: number,
    currency = 'BOB',
    simulatedStatus?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'EXPIRADO',
  ): SandboxPaymentSession {
    this.assertSimulatorAllowed();
    const paymentId = `SANDBOX-PAY-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const status = simulatedStatus || 'APROBADO';

    const session: SandboxPaymentSession = {
      paymentId,
      orderId,
      amount,
      currency,
      status,
      merchantId: this.MERCHANT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.paymentSessions.set(paymentId, session);
    return session;
  }

  // 2. Consultar estado de pago en el simulador
  getPaymentSession(paymentId: string): SandboxPaymentSession | undefined {
    this.assertSimulatorAllowed();
    return this.paymentSessions.get(paymentId);
  }

  // 3. Crear sesión de reembolso en el simulador
  createRefundSession(
    orderId: string,
    amount: number,
    reason: string,
    currency = 'BOB',
    simulatedStatus?: 'COMPLETADO' | 'FALLIDO' | 'PENDIENTE' | 'EN_PROCESO',
  ): SandboxRefundSession {
    this.assertSimulatorAllowed();
    const refundId = `SANDBOX-REF-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`;
    const status = simulatedStatus || 'COMPLETADO';

    const session: SandboxRefundSession = {
      refundId,
      orderId,
      amount,
      currency,
      reason,
      status,
      merchantId: this.MERCHANT_ID,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.refundSessions.set(refundId, session);
    return session;
  }

  // 4. Consultar estado de reembolso en el simulador
  getRefundSession(refundId: string): SandboxRefundSession | undefined {
    this.assertSimulatorAllowed();
    return this.refundSessions.get(refundId);
  }

  // 5. Generar firma HMAC SHA-256 para webhooks
  computeSignature(payload: string, secret?: string): string {
    const sec = secret || this.WEBHOOK_SECRET;
    if (!sec) {
      throw new ForbiddenException(
        'Secreto de webhook no configurado en variables de entorno.',
      );
    }
    return createHmac('sha256', sec).update(payload).digest('hex');
  }

  // 6. Validar firma HMAC con comparación segura en tiempo constante
  verifySignature(payload: string, signature: string, secret?: string): boolean {
    if (!signature || !payload) return false;
    try {
      const sec = secret || this.WEBHOOK_SECRET;
      if (!sec) return false;

      const expected = this.computeSignature(payload, sec);
      const expectedBuffer = Buffer.from(expected, 'hex');
      const providedBuffer = Buffer.from(signature, 'hex');

      if (expectedBuffer.length !== providedBuffer.length) {
        return false;
      }
      return timingSafeEqual(expectedBuffer, providedBuffer);
    } catch {
      return false;
    }
  }

  // 7. Construir carga y firma de evento webhook
  buildWebhookPayload(
    event:
      | 'payment.succeeded'
      | 'payment.failed'
      | 'refund.succeeded'
      | 'refund.failed',
    data: {
      orderId: string;
      amount?: number;
      transactionId?: string;
      refundId?: string;
      reason?: string;
      status?: string;
    },
    customSecret?: string,
  ) {
    this.assertSimulatorAllowed();
    const eventId = `EVT-${Date.now()}-${randomBytes(4).toString('hex')}`;
    const timestamp = new Date().toISOString();

    const body = {
      id: eventId,
      event,
      timestamp,
      merchantId: this.MERCHANT_ID,
      data: {
        orderId: data.orderId,
        amount: data.amount,
        transactionId:
          data.transactionId ||
          `SANDBOX-TX-${Date.now()}-${randomBytes(4).toString('hex').toUpperCase()}`,
        refundId: data.refundId,
        reason: data.reason,
        status: data.status || 'PROCESSED',
      },
    };

    const payloadString = JSON.stringify(body);
    const signature = this.computeSignature(
      payloadString,
      customSecret || this.WEBHOOK_SECRET,
    );

    return {
      eventId,
      timestamp,
      signature,
      body,
      rawPayload: payloadString,
    };
  }
}
