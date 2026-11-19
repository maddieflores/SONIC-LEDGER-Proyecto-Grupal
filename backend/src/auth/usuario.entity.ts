import {
  Column,
  CreateDateColumn,
  Entity,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Rol } from './rol.entity.js';
import { Artista } from '../musica/artista.entity.js';

export { Rol } from './rol.entity.js';

export enum RolLegacy {
  USUARIO = 'usuario',
  ADMIN = 'admin',
}

@Entity('usuarios')
export class Usuario {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 60 })
  username!: string;

  @Column({ unique: true, length: 254 })
  email!: string;

  @Column({ select: false })
  passwordHash!: string;

  // Columna de transición conservada para no perder datos históricos
  @Column({ type: 'varchar', length: 20, nullable: true, select: false })
  role?: string | null;

  @ManyToMany(() => Rol, { eager: true })
  @JoinTable({
    name: 'usuarios_roles',
    joinColumn: { name: 'usuario_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'rol_id', referencedColumnName: 'id' },
  })
  roles!: Relation<Rol>[];

  @OneToOne(() => Artista, (artista) => artista.usuario)
  perfilArtistico?: Relation<Artista>;

  @Column({ type: 'varchar', length: 60, nullable: true })
  displayName!: string | null;

  @Column({ type: 'varchar', length: 300, default: '' })
  biography!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  musicPreferences!: { genreIds?: string[]; moods?: string[]; intensity?: number; discovery?: number; energy?: number };

  @Column({ default: 0 })
  authVersion!: number;

  @Column({ type: 'varchar', length: 64, nullable: true, select: false })
  passwordResetHash!: string | null;

  @Column({ type: 'timestamptz', nullable: true, select: false })
  passwordResetExpiresAt!: Date | null;

  @CreateDateColumn()
  createdAt!: Date;
}
