import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ListeningHistory1794489000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS listening_history (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        track_id varchar(100) NOT NULL,
        source varchar(10) NOT NULL DEFAULT 'LOCAL',
        client_event_id varchar(100) NULL,
        event_type varchar(20) NOT NULL DEFAULT 'PLAYED',
        listened_seconds real NOT NULL DEFAULT 0,
        track_duration_seconds real NULL,
        started_at timestamptz NOT NULL DEFAULT now(),
        ended_at timestamptz NOT NULL DEFAULT now(),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS listening_history_usuario_created_idx
      ON listening_history(usuario_id, "createdAt" DESC)
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS listening_history_user_client_event_idx
      ON listening_history(usuario_id, client_event_id)
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Reversión destructiva deshabilitada para preservar el historial de usuarios.',
    );
  }
}
