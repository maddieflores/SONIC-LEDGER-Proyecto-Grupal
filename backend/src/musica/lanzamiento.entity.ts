import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Artista } from './artista.entity.js';
import { Cancion } from './cancion.entity.js';

export enum LanzamientoTipo {
  SINGLE = 'SINGLE',
  EP = 'EP',
  ALBUM = 'ALBUM',
}

export enum LanzamientoEstado {
  BORRADOR = 'borrador',
  PUBLICADO = 'publicado',
}

@Entity('lanzamientos')
export class Lanzamiento {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'artista_id', type: 'uuid' })
  artistaId!: string;

  @ManyToOne(() => Artista, (artista) => artista.lanzamientos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'artista_id' })
  artista!: Relation<Artista>;

  @Column({ type: 'varchar', length: 150 })
  titulo!: string;

  @Column({ type: 'varchar', length: 2000, default: '' })
  descripcion!: string;

  @Column({ type: 'enum', enum: LanzamientoTipo })
  tipo!: LanzamientoTipo;

  @Column({ name: 'portada_url', type: 'varchar', length: 500, nullable: true })
  portadaUrl!: string | null;

  @Column({ name: 'fecha_lanzamiento', type: 'timestamptz', nullable: true })
  fechaLanzamiento!: Date | null;

  @Column({ type: 'enum', enum: LanzamientoEstado, default: LanzamientoEstado.BORRADOR })
  estado!: LanzamientoEstado;

  @OneToMany(() => Cancion, (cancion) => cancion.lanzamiento)
  canciones!: Relation<Cancion>[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
