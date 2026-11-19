import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Ticket } from './ticket.entity.js';
import { Concierto } from '../conciertos/concierto.entity.js';
import { Usuario } from '../auth/usuario.entity.js';

export enum ValidacionResultado {
  EXITOSO = 'EXITOSO',
  YA_UTILIZADO = 'YA_UTILIZADO',
  EVENTO_INCORRECTO = 'EVENTO_INCORRECTO',
  INVALIDADO = 'INVALIDADO',
  NO_ENCONTRADO = 'NO_ENCONTRADO',
  NO_AUTORIZADO = 'NO_AUTORIZADO',
}

@Entity('ticket_validaciones')
export class TicketValidacion {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'ticket_id', type: 'uuid', nullable: true })
  ticketId!: string | null;

  @ManyToOne(() => Ticket, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'ticket_id' })
  ticket?: Relation<Ticket> | null;

  @Column({ name: 'concierto_id', type: 'uuid' })
  conciertoId!: string;

  @ManyToOne(() => Concierto, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'concierto_id' })
  concierto!: Relation<Concierto>;

  @Column({ name: 'verificador_id', type: 'uuid' })
  verificadorId!: string;

  @ManyToOne(() => Usuario, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'verificador_id' })
  verificador!: Relation<Usuario>;

  @Column({
    type: 'varchar',
    length: 30,
  })
  resultado!: ValidacionResultado;

  @Column({ type: 'varchar', length: 255, nullable: true })
  motivo!: string | null;

  @CreateDateColumn({ name: 'fecha_validacion' })
  fechaValidacion!: Date;
}
