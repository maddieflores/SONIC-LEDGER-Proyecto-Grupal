import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Concierto } from '../conciertos/concierto.entity.js';
import { Usuario } from '../auth/usuario.entity.js';

@Entity('concierto_verificadores')
@Unique(['conciertoId', 'usuarioId'])
export class ConciertoVerificador {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Relation<Usuario>;

  @Column({ name: 'asignado_por', type: 'uuid' })
  asignadoPor!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'asignado_por' })
  asignadoPorUsuario!: Relation<Usuario>;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
