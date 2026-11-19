import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreatePaymentIntentDto {
  @IsString()
  orderId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  currency?: string;

  @IsOptional()
  @IsIn(['APROBADO', 'RECHAZADO', 'PENDIENTE', 'EXPIRADO'])
  simulatedStatus?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE' | 'EXPIRADO';
}

export class CreateRefundIntentDto {
  @IsString()
  orderId!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  reason!: string;

  @IsOptional()
  @IsIn(['COMPLETADO', 'FALLIDO', 'PENDIENTE', 'EN_PROCESO'])
  simulatedStatus?: 'COMPLETADO' | 'FALLIDO' | 'PENDIENTE' | 'EN_PROCESO';
}

export class TriggerWebhookDto {
  @IsString()
  targetUrl!: string;

  @IsString()
  @IsIn(['payment.succeeded', 'payment.failed', 'refund.succeeded', 'refund.failed'])
  event!: 'payment.succeeded' | 'payment.failed' | 'refund.succeeded' | 'refund.failed';

  @IsString()
  orderId!: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  transactionId?: string;

  @IsOptional()
  @IsString()
  refundId?: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  customSecret?: string;
}
