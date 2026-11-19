import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export enum RolNombre {
  CLIENTE = 'CLIENTE',
  ARTISTA = 'ARTISTA',
  ORGANIZADOR = 'ORGANIZADOR',
  VERIFICADOR = 'VERIFICADOR',
  ADMIN = 'ADMIN',
}

@Entity('roles')
export class Rol {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  nombre!: RolNombre;

  @Column({ type: 'varchar', length: 255, nullable: true })
  descripcion!: string | null;

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;
}
