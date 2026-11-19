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
import { Artista } from './artista.entity.js';
import { Lanzamiento } from './lanzamiento.entity.js';
import { Genero } from './genero.entity.js';

export enum CancionEstado {
  BORRADOR = 'borrador',
  PUBLICADO = 'publicado',
}

@Entity('canciones')
export class Cancion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artista_id', type: 'uuid' })
  artistaId!: string;

  @ManyToOne(() => Artista, (artista) => artista.canciones, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'artista_id' })
  artista!: Relation<Artista>;

  @Column({ name: 'lanzamiento_id', type: 'uuid', nullable: true })
  lanzamientoId!: string | null;

  @Column({ name: 'numero_pista', type: 'integer', nullable: true })
  numeroPista!: number | null;

  @ManyToOne(() => Lanzamiento, (lanzamiento) => lanzamiento.canciones, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'lanzamiento_id' })
  lanzamiento!: Relation<Lanzamiento> | null;

  @Column({ name: 'genero_id', type: 'uuid', nullable: true })
  generoId!: string | null;

  @ManyToOne(() => Genero, (genero) => genero.canciones, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'genero_id' })
  genero!: Relation<Genero> | null;

  @Column({ type: 'varchar', length: 150 })
  titulo!: string;

  @Column({
    name: 'archivo_audio_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  archivoAudioUrl!: string | null;

  @Column({ type: 'varchar', length: 2000, default: '' })
  descripcion!: string;

  @Column({ name: 'portada_url', type: 'varchar', length: 500, nullable: true })
  portadaUrl!: string | null;

  @Column({ name: 'duracion_segundos', type: 'integer', nullable: true })
  duracionSegundos!: number | null;

  @Column({
    type: 'enum',
    enum: CancionEstado,
    default: CancionEstado.BORRADOR,
  })
  estado!: CancionEstado;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
