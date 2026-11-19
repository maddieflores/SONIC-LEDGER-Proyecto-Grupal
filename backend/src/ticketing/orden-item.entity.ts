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

@Entity('orden_items')
export class OrdenItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'orden_id', type: 'uuid' })
  ordenId!: string;

  @ManyToOne(() => OrdenCompra, (o) => o.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orden_id' })
  orden!: Relation<OrdenCompra>;

  @Column({ name: 'categoria_id', type: 'uuid' })
  categoriaId!: string;

  @ManyToOne(() => ConciertoCategoria, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'categoria_id' })
  categoria!: Relation<ConciertoCategoria>;

  @Column({ type: 'int' })
  cantidad!: number;

  @Column({ name: 'precio_unitario', type: 'numeric', precision: 10, scale: 2 })
  precioUnitario!: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  subtotal!: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
