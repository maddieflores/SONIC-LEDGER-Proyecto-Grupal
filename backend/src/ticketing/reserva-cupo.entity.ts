import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { OrdenCompra } from './orden-compra.entity.js';
import { ConciertoCategoria } from '../conciertos/concierto-categoria.entity.js';

@Entity('reservas_cupo')
export class ReservaCupo {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId!: string;

  @ManyToOne(() => OrdenCompra, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden!: Relation<OrdenCompra>;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @ManyToOne(() => ConciertoCategoria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: Relation<ConciertoCategoria>;

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ name: 'expira_en', type: 'timestamptz' })
  expiraEn!: Date;

  @Column({ type: 'boolean', default: false })
  liberada!: boolean;

  @Column({ type: 'boolean', default: false })
  confirmada!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
