import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReembolsosYSandbox1794493000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // 1. Agregar columna monto_reembolsado a ordenes_compra
    await q.query(`
      ALTER TABLE ordenes_compra
      ADD COLUMN IF NOT EXISTS monto_reembolsado numeric(10, 2) NOT NULL DEFAULT 0;
    `);

    // 2. Crear tabla reembolsos
    await q.query(`
      CREATE TABLE IF NOT EXISTS reembolsos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        orden_id uuid NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        reembolso_transaccion_id varchar(100) NOT NULL UNIQUE,
        monto numeric(10, 2) NOT NULL,
        moneda varchar(10) NOT NULL DEFAULT 'BOB',
        tipo varchar(20) NOT NULL DEFAULT 'TOTAL',
        estado varchar(30) NOT NULL DEFAULT 'PENDIENTE',
        motivo text NOT NULL,
        solicitado_por_id uuid NULL REFERENCES usuarios(id) ON DELETE SET NULL,
        procesado_en timestamptz NULL,
        mensaje_resultado text NULL,
        idempotency_key varchar(120) NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
    `);

    // 3. Crear índices para optimizar consultas de reembolsos
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_reembolsos_orden ON reembolsos(orden_id);
      CREATE INDEX IF NOT EXISTS idx_reembolsos_concierto ON reembolsos(concierto_id);
      CREATE INDEX IF NOT EXISTS idx_reembolsos_estado ON reembolsos(estado);
      CREATE INDEX IF NOT EXISTS idx_reembolsos_idempotency ON reembolsos(idempotency_key);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP TABLE IF EXISTS reembolsos CASCADE;
      ALTER TABLE ordenes_compra DROP COLUMN IF EXISTS monto_reembolsado;
    `);
  }
}
