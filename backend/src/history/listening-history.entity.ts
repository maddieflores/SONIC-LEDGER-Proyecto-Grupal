import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Usuario } from '../auth/usuario.entity.js';

export type HistoryEventType = 'PLAYED' | 'SKIPPED';
export type TrackSource = 'LOCAL' | 'AUDIUS';

@Entity('listening_history')
@Index('listening_history_usuario_created_idx', ['usuarioId', 'createdAt'])
export class ListeningHistory {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid' })
  usuarioId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Relation<Usuario>;

  @Column({ name: 'track_id', type: 'varchar', length: 100 })
  trackId!: string;

  @Column({ type: 'varchar', length: 10, default: 'LOCAL' })
  source!: TrackSource;

  @Column({ name: 'client_event_id', type: 'varchar', length: 100, nullable: true })
  clientEventId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 20, default: 'PLAYED' })
  eventType!: HistoryEventType;

  @Column({ name: 'listened_seconds', type: 'real', default: 0 })
  listenedSeconds!: number;

  @Column({ name: 'track_duration_seconds', type: 'real', nullable: true })
  trackDurationSeconds!: number | null;

  @Column({ name: 'started_at', type: 'timestamptz', default: () => 'now()' })
  startedAt!: Date;

  @Column({ name: 'ended_at', type: 'timestamptz', default: () => 'now()' })
  endedAt!: Date;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
