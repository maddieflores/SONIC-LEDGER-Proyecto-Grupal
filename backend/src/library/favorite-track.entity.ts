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
import { Usuario } from '../auth/usuario.entity.js';

@Entity('favorite_tracks')
@Unique('favorite_tracks_unique_user_track', ['usuarioId', 'trackId'])
export class FavoriteTrack {
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
  source!: 'LOCAL' | 'AUDIUS';

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
