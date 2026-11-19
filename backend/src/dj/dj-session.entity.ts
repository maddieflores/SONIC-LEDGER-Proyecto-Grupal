import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import type { DjSession } from './dj.types.js';
@Entity('dj_sessions')
export class DjSessionEntity {
  @PrimaryGeneratedColumn('uuid') id!: string;
  @Column({ name: 'usuario_id', type: 'uuid' }) usuarioId!: string;
  @Column({ type: 'jsonb' }) state!: DjSession;
}
