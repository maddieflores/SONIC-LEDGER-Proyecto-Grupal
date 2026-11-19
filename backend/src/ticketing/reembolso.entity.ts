import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OrdenCompra } from './orden-compra.entity.js';
import { Concierto } from '../conciertos/concierto.entity.js';
import { Usuario } from '../auth/usuario.entity.js';

export enum ReembolsoTipo {
  TOTAL = 'TOTAL',
  PARCIAL = 'PARCIAL',
}

export enum ReembolsoEstadoOperacion {
  PENDIENTE = 'PENDIENTE',
  EN_PROCESO = 'EN_PROCESO',
  COMPLETADO = 'COMPLETADO',
  FALLIDO = 'FALLIDO',
}

@Entity('reembolsos')
export class Reembolso {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId!: string;

  @ManyToOne(() => OrdenCompra, (orden) => orden.reembolsos, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'orden_id' })
  orden!: Relation<OrdenCompra>;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({
    name: 'reembolso_transaccion_id',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  reembolsoTransaccionId!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  monto!: number;

  @Column({ type: 'varchar', length: 10, default: 'BOB' })
  moneda!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ReembolsoTipo.TOTAL,
  })
  tipo!: ReembolsoTipo;

  @Column({
    type: 'varchar',
    length: 30,
    default: ReembolsoEstadoOperacion.PENDIENTE,
  })
  estado!: ReembolsoEstadoOperacion;

  @Column({ type: 'text' })
  motivo!: string;

  @Column({ name: 'solicitado_por_id', type: 'uuid', nullable: true })
  solicitadoPorId!: string | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'solicitado_por_id' })
  solicitadoPor?: Relation<Usuario> | null;

  @Column({ name: 'procesado_en', type: 'timestamptz', nullable: true })
  procesadoEn!: Date | null;

  @Column({ name: 'mensaje_resultado', type: 'text', nullable: true })
  mensajeResultado!: string | null;

  @Column({
    name: 'idempotency_key',
    type: 'varchar',
    length: 120,
    nullable: true,
    unique: true,
  })
  idempotencyKey!: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
