import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CancelacionConciertosYReembolsos1794492000000
  implements MigrationInterface
{
  async up(q: QueryRunner): Promise<void> {
    // 1. Columnas de cancelación en conciertos
    await q.query(`
      ALTER TABLE conciertos
      ADD COLUMN IF NOT EXISTS motivo_cancelacion text NULL,
      ADD COLUMN IF NOT EXISTS cancelado_en timestamptz NULL,
      ADD COLUMN IF NOT EXISTS cancelado_por_id uuid NULL REFERENCES usuarios(id) ON DELETE SET NULL;
    `);

    // 2. Columna de estado de reembolso en ordenes_compra
    await q.query(`
      ALTER TABLE ordenes_compra
      ADD COLUMN IF NOT EXISTS reembolso_estado varchar(30) NOT NULL DEFAULT 'NINGUNO';
    `);

    // 3. Columna de motivo de invalidación en tickets
    await q.query(`
      ALTER TABLE tickets
      ADD COLUMN IF NOT EXISTS motivo_invalidacion varchar(100) NULL;
    `);

    // 4. Índices para consultas de estadísticas y cancelaciones
    await q.query(`
      CREATE INDEX IF NOT EXISTS idx_conciertos_estado ON conciertos(estado);
      CREATE INDEX IF NOT EXISTS idx_ordenes_concierto_estado ON ordenes_compra(concierto_id, estado);
      CREATE INDEX IF NOT EXISTS idx_ordenes_reembolso ON ordenes_compra(reembolso_estado);
      CREATE INDEX IF NOT EXISTS idx_tickets_concierto_estado ON tickets(concierto_id, estado);
    `);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`
      DROP INDEX IF EXISTS idx_tickets_concierto_estado;
      DROP INDEX IF EXISTS idx_ordenes_reembolso;
      DROP INDEX IF EXISTS idx_ordenes_concierto_estado;
      DROP INDEX IF EXISTS idx_conciertos_estado;
      ALTER TABLE tickets DROP COLUMN IF EXISTS motivo_invalidacion;
      ALTER TABLE ordenes_compra DROP COLUMN IF EXISTS reembolso_estado;
      ALTER TABLE conciertos
        DROP COLUMN IF EXISTS cancelado_por_id,
        DROP COLUMN IF EXISTS cancelado_en,
        DROP COLUMN IF EXISTS motivo_cancelacion;
    `);
  }
}
