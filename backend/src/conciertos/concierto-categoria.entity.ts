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
import { Concierto } from './concierto.entity.js';

@Entity('concierto_categorias')
export class ConciertoCategoria {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, (c) => c.categorias, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({ type: 'varchar', length: 100 })
  nombre!: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  precio!: number;

  @Column({ type: 'varchar', length: 10, default: 'BOB' })
  moneda!: string;

  @Column({ name: 'cupo_total', type: 'int', default: 0 })
  cupoTotal!: number;

  @Column({ name: 'cupo_disponible', type: 'int', default: 0 })
  cupoDisponible!: number;

  @Column({ type: 'boolean', default: true })
  disponible!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
