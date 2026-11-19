import type { MigrationInterface, QueryRunner } from 'typeorm';
export class DjSessions1794494000000 implements MigrationInterface {
  async up(q: QueryRunner) {
    await q.query(
      `CREATE TABLE dj_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE, state jsonb NOT NULL)`,
    );
    await q.query(
      `CREATE INDEX dj_sessions_owner_idx ON dj_sessions(usuario_id)`,
    );
  }
  async down(): Promise<void> {
    throw new Error('Reversión destructiva deshabilitada.');
  }
}
