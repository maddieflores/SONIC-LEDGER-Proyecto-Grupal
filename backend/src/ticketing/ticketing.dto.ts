import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsUUID('4', { message: 'El ID del concierto debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El concierto es obligatorio.' })
  conciertoId!: string;

  @IsUUID('4', { message: 'El ID de la categoría debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La categoría es obligatoria.' })
  categoriaId!: string;

  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'Debes comprar al menos 1 entrada.' })
  @Max(10, { message: 'Máximo 10 entradas por transacción.' })
  cantidad!: number;

  @IsString()
  @IsOptional()
  operacionId?: string;
}

export class ProcessPaymentDto {
  @IsUUID('4', { message: 'El ID de orden debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La orden es obligatoria.' })
  ordenId!: string;

  @IsEnum(['APROBADO', 'RECHAZADO', 'PENDIENTE'], {
    message: 'El resultado simulado debe ser APROBADO, RECHAZADO o PENDIENTE.',
  })
  @IsOptional()
  simularResultado?: 'APROBADO' | 'RECHAZADO' | 'PENDIENTE';
}

export class ValidateQrDto {
  @IsUUID('4', { message: 'El ID de concierto debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El concierto es obligatorio.' })
  conciertoId!: string;

  @IsString()
  @IsNotEmpty({ message: 'El token QR es obligatorio.' })
  qrToken!: string;
}

export class AssignVerifierDto {
  @IsUUID('4', { message: 'El ID de usuario debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El usuario verificador es obligatorio.' })
  usuarioId!: string;
}

export class SolicitarReembolsoDto {
  @IsUUID('4', { message: 'El ID de la orden debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'La orden es obligatoria.' })
  ordenId!: string;

  @IsOptional()
  @Min(0.01, { message: 'El monto de devolución debe ser mayor a 0.' })
  monto?: number;

  @IsString({ message: 'El motivo debe ser texto.' })
  @IsNotEmpty({ message: 'El motivo es obligatorio.' })
  motivo!: string;

  @IsOptional()
  @IsEnum(['TOTAL', 'PARCIAL'], {
    message: 'El tipo debe ser TOTAL o PARCIAL.',
  })
  tipo?: 'TOTAL' | 'PARCIAL';

  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}

export class ProcesarReembolsoSimuladoDto {
  @IsUUID('4', { message: 'El ID de reembolso debe ser un UUID válido.' })
  @IsNotEmpty({ message: 'El ID de reembolso es obligatorio.' })
  reembolsoId!: string;

  @IsEnum(['COMPLETAR', 'FALLAR'], {
    message: 'La acción debe ser COMPLETAR o FALLAR.',
  })
  accion!: 'COMPLETAR' | 'FALLAR';

  @IsOptional()
  @IsString()
  mensaje?: string;
}
