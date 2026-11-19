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
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';
import { Usuario } from '../auth/usuario.entity.js';

export enum TicketEstado {
  VIGENTE = 'VIGENTE',
  UTILIZADO = 'UTILIZADO',
  INVALIDADO = 'INVALIDADO',
}

@Entity('tickets')
export class Ticket {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId!: string;

  @ManyToOne(() => OrdenCompra, (o) => o.tickets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden!: Relation<OrdenCompra>;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @ManyToOne(() => ConciertoCategoria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: Relation<ConciertoCategoria>;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Relation<Usuario>;

  @Column({
    type: 'varchar',
    length: 20,
    default: TicketEstado.VIGENTE,
  })
  estado!: TicketEstado;

  @Column({ name: 'codigo_publico', type: 'varchar', length: 50, unique: true })
  codigoPublico!: string;

  @Column({ name: 'qr_token', type: 'varchar', length: 120, unique: true })
  qrToken!: string;

  @Column({ name: 'fecha_emision', type: 'timestamptz' })
  fechaEmision!: Date;

  @Column({ name: 'fecha_utilizado', type: 'timestamptz', nullable: true })
  fechaUtilizado!: Date | null;

  @Column({ name: 'motivo_invalidacion', type: 'varchar', length: 100, nullable: true })
  motivoInvalidacion!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
