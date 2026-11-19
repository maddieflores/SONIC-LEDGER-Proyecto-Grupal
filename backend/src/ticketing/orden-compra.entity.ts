import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Usuario } from '../auth/usuario.entity.js';
import { Concierto } from '../conciertos/concierto.entity.js';
import { OrdenItem } from './orden-item.entity.js';
import { Ticket } from './ticket.entity.js';
import { Reembolso } from './reembolso.entity.js';

export enum OrdenEstado {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADA = 'CONFIRMADA',
  EXPIRADA = 'EXPIRADA',
  CANCELADA = 'CANCELADA',
  FALLIDA = 'FALLIDA',
}

export enum ReembolsoEstado {
  NINGUNO = 'NINGUNO',
  PENDIENTE_REEMBOLSO = 'PENDIENTE_REEMBOLSO',
  REEMBOLSADO = 'REEMBOLSADO',
  REEMBOLSO_PARCIAL = 'REEMBOLSO_PARCIAL',
}

@Entity('ordenes_compra')
export class OrdenCompra {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Relation<Usuario>;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({
    type: 'varchar',
    length: 20,
    default: OrdenEstado.PENDIENTE,
  })
  estado!: OrdenEstado;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  total!: number;

  @Column({ type: 'varchar', length: 10, default: 'BOB' })
  moneda!: string;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn!: Date;

  @Column({ name: 'operacion_id', type: 'varchar', length: 100, unique: true })
  operacionId!: string;

  @Column({ name: 'proveedor_pago', type: 'varchar', length: 50, nullable: true, default: 'MOCK' })
  proveedorPago!: string | null;

  @Column({ name: 'pago_transaccion_id', type: 'varchar', length: 100, nullable: true })
  pagoTransaccionId!: string | null;

  @Column({ name: 'pago_estado', type: 'varchar', length: 30, nullable: true })
  pagoEstado!: string | null;

  @Column({ name: 'confirmada_en', type: 'timestamptz', nullable: true })
  confirmadaEn!: Date | null;

  @Column({
    name: 'reembolso_estado',
    type: 'varchar',
    length: 30,
    default: ReembolsoEstado.NINGUNO,
  })
  reembolsoEstado!: ReembolsoEstado;

  @Column({
    name: 'monto_reembolsado',
    type: 'numeric',
    precision: 10,
    scale: 2,
    default: 0,
  })
  montoReembolsado!: number;

  @OneToMany(() => Reembolso, (reembolso) => reembolso.orden)
  reembolsos?: Relation<Reembolso>[];

  @OneToMany(() => OrdenItem, (item) => item.orden, { cascade: true })
  items?: Relation<OrdenItem>[];

  @OneToMany(() => Ticket, (ticket) => ticket.orden)
  tickets?: Relation<Ticket>[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
