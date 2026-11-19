import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Cancion } from './cancion.entity.js';

@Entity('generos')
export class Genero {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  nombre!: string;

  @Column({ type: 'text', nullable: true })
  descripcion!: string | null;

  @Column({ type: 'boolean', default: true })
  activo!: boolean;

  @OneToMany(() => Cancion, (cancion) => cancion.genero)
  canciones!: Relation<Cancion>[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
