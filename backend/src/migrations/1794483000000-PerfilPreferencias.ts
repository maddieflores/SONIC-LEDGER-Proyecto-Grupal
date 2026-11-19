import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PerfilPreferencias1794483000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE usuarios ADD COLUMN "displayName" varchar(60), ADD COLUMN biography varchar(300) NOT NULL DEFAULT '', ADD COLUMN "musicPreferences" jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
  }
  async down(): Promise<void> {
    throw new Error(
      'Reversión automática deshabilitada para preservar perfiles.',
    );
  }
}
