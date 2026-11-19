import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Concierto } from './concierto.entity.js';
import { Artista } from '../musica/artista.entity.js';

@Entity('concierto_artistas')
export class ConciertoArtista {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, (c) => c.artistas, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({ name: 'artista_id', type: 'uuid', nullable: true })
  artistaId!: string | null;

  @ManyToOne(() => Artista, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'artista_id' })
  artista?: Relation<Artista> | null;

  @Column({ name: 'nombre_artista', type: 'varchar', length: 100 })
  nombreArtista!: string;

  @Column({ type: 'int', default: 1 })
  orden!: number;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
