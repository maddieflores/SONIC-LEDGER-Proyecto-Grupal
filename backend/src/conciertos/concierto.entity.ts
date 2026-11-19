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
import { Usuario } from '../auth/usuario.entity.js';
import { ConciertoArtista } from './concierto-artista.entity.js';
import { ConciertoCategoria } from './concierto-categoria.entity.js';

export enum ConciertoEstado {
  BORRADOR = 'BORRADOR',
  PUBLICADO = 'PUBLICADO',
  CANCELADO = 'CANCELADO',
}

export enum ConciertoEstadoVenta {
  VENTA_NO_INICIADA = 'VENTA_NO_INICIADA',
  VENTA_PENDIENTE = 'VENTA_PENDIENTE',
  VENTA_INICIADA = 'VENTA_INICIADA',
  VENTA_CERRADA = 'VENTA_CERRADA',
}

@Entity('conciertos')
export class Concierto {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'organizador_id', type: 'uuid' })
  organizadorId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organizador_id' })
  organizador!: Relation<Usuario>;

  @Column({ type: 'varchar', length: 200 })
  titulo!: string;

  @Column({ type: 'text', default: '' })
  descripcion!: string;

  @Column({ name: 'portada_url', type: 'varchar', length: 500, nullable: true })
  portadaUrl!: string | null;

  @Column({ type: 'varchar', length: 100, default: '' })
  genero!: string;

  @Column({ name: 'fecha_inicio', type: 'timestamptz' })
  fechaInicio!: Date;

  @Column({ name: 'fecha_fin', type: 'timestamptz' })
  fechaFin!: Date;

  @Column({ name: 'zona_horaria', type: 'varchar', length: 50, default: 'America/La_Paz' })
  zonaHoraria!: string;

  @Column({ type: 'varchar', length: 200 })
  recinto!: string;

  @Column({ type: 'varchar', length: 255 })
  direccion!: string;

  @Column({ type: 'varchar', length: 100 })
  ciudad!: string;

  @Column({ type: 'varchar', length: 100 })
  departamento!: string;

  @Column({
    type: 'varchar',
    length: 20,
    default: ConciertoEstado.BORRADOR,
  })
  estado!: ConciertoEstado;

  @Column({ name: 'inicio_venta', type: 'timestamptz', nullable: true })
  inicioVenta!: Date | null;

  @Column({ type: 'boolean', default: false })
  destacado!: boolean;

  @Column({ name: 'motivo_cancelacion', type: 'text', nullable: true })
  motivoCancelacion!: string | null;

  @Column({ name: 'cancelado_en', type: 'timestamptz', nullable: true })
  canceladoEn!: Date | null;

  @Column({ name: 'cancelado_por_id', type: 'uuid', nullable: true })
  canceladoPorId!: string | null;

  @ManyToOne(() => Usuario, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'cancelado_por_id' })
  canceladoPor?: Relation<Usuario> | null;

  @OneToMany(() => ConciertoArtista, (ca) => ca.concierto, {
    cascade: true,
  })
  artistas?: Relation<ConciertoArtista>[];

  @OneToMany(() => ConciertoCategoria, (cc) => cc.concierto, {
    cascade: true,
  })
  categorias?: Relation<ConciertoCategoria>[];

  @CreateDateColumn({ name: 'createdAt' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updatedAt' })
  updatedAt!: Date;
}
