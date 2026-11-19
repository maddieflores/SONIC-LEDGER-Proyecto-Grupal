export interface PaymentResult {
  success: boolean;
  status: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
  transactionId: string;
  provider: string;
  amount: number;
  message: string;
}

export interface PaymentProvider {
  processPayment(
    orderId: string,
    amount: number,
    options?: { simulateStatus?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' },
  ): Promise<PaymentResult>;
}
