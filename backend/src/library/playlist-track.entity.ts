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
import { Playlist } from './playlist.entity.js';

@Entity('playlist_tracks')
@Unique('playlist_tracks_unique_track', ['playlistId', 'trackId'])
export class PlaylistTrack {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'playlist_id', type: 'uuid' })
  playlistId!: string;

  @ManyToOne(() => Playlist, (p) => p.tracks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'playlist_id' })
  playlist!: Relation<Playlist>;

  @Column({ name: 'track_id', type: 'varchar', length: 100 })
  trackId!: string;

  @Column({ type: 'varchar', length: 10, default: 'LOCAL' })
  source!: 'LOCAL' | 'AUDIUS';

  @Column({ type: 'integer' })
  posicion!: number;

  @CreateDateColumn({ name: 'addedAt' })
  addedAt!: Date;
}
