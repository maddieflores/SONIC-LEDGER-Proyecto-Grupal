import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type {
  PaymentProvider,
  PaymentResult,
} from './payment-provider.interface.js';

@Injectable()
export class MockPaymentProvider implements PaymentProvider {
  async processPayment(
    orderId: string,
    amount: number,
    options?: { simulateStatus?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' },
  ): Promise<PaymentResult> {
    const status = options?.simulateStatus || 'APROBADO';
    const isApproved = status === 'APROBADO';
    const transactionId = `MOCK-TX-${Date.now()}-${randomUUID().slice(0, 8)}`;

    return {
      success: isApproved,
      status,
      transactionId,
      provider: 'MOCK_PROVIDER',
      amount,
      message: 'PAGO DE PRUEBA — NO SE REALIZA NINGÚN COBRO REAL',
    };
  }
}
