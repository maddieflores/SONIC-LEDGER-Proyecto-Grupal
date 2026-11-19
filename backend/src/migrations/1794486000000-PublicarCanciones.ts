import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PublicarCanciones1794486000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE canciones ALTER COLUMN archivo_audio_url DROP NOT NULL, ADD COLUMN descripcion varchar(2000) NOT NULL DEFAULT ''`,
    );
    await q.query(
      `CREATE INDEX canciones_artista_actualizacion_idx ON canciones (artista_id, "updatedAt" DESC)`,
    );
  }
  async down(): Promise<void> {
    throw new Error(
      'Reversión destructiva deshabilitada para preservar canciones.',
    );
  }
}
