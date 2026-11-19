import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OrganizarLanzamientos1794487000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE lanzamientos ADD COLUMN IF NOT EXISTS descripcion varchar(2000) NOT NULL DEFAULT ''`,
    );
    await q.query(
      `ALTER TABLE canciones ADD COLUMN IF NOT EXISTS numero_pista integer CHECK (numero_pista IS NULL OR numero_pista > 0)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS canciones_lanzamiento_numero_pista_idx ON canciones (lanzamiento_id, numero_pista)`,
    );
    await q.query(
      `CREATE INDEX IF NOT EXISTS lanzamientos_artista_updated_idx ON lanzamientos (artista_id, "updatedAt" DESC)`,
    );
  }

  async down(): Promise<void> {
    throw new Error(
      'Reversión destructiva deshabilitada para preservar lanzamientos.',
    );
  }
}
