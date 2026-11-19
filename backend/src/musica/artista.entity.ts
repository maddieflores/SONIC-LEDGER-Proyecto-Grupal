import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Usuario } from '../auth/usuario.entity.js';
import { Lanzamiento } from './lanzamiento.entity.js';
import { Genero } from './genero.entity.js';
import { Cancion } from './cancion.entity.js';

@Entity('artistas')
export class Artista {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'usuario_id', type: 'uuid', unique: true })
  usuarioId!: string;

  @OneToOne(() => Usuario, (usuario) => usuario.perfilArtistico, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'usuario_id' })
  usuario!: Relation<Usuario>;

  @Column({
    name: 'nombre_artistico',
    type: 'varchar',
    length: 100,
    unique: true,
  })
  nombreArtistico!: string;

  @Column({ type: 'text', nullable: true })
  biografia!: string | null;

  @Column({ name: 'avatar_url', type: 'varchar', length: 500, nullable: true })
  avatarUrl!: string | null;

  @Column({ name: 'cover_url', type: 'varchar', length: 500, nullable: true })
  coverUrl!: string | null;

  @Column({ type: 'varchar', length: 80, default: '' })
  ciudad!: string;

  @Column({ type: 'varchar', length: 80, default: '' })
  pais!: string;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  identidad!: string[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  redes!: {
    instagram?: string;
    tiktok?: string;
    youtube?: string;
    spotify?: string;
    website?: string;
  };

  @ManyToMany(() => Genero)
  @JoinTable({
    name: 'artistas_generos',
    joinColumn: { name: 'artista_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'genero_id', referencedColumnName: 'id' },
  })
  generos!: Relation<Genero>[];

  @OneToMany(() => Lanzamiento, (lanzamiento) => lanzamiento.artista)
  lanzamientos!: Relation<Lanzamiento>[];

  @OneToMany(() => Cancion, (cancion) => cancion.artista)
  canciones!: Relation<Cancion>[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
