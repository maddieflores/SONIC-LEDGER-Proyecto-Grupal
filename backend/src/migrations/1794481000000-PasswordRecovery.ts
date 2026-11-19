import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PasswordRecovery1794481000000 implements MigrationInterface {
 async up(q: QueryRunner): Promise<void> {
  await q.query(`ALTER TABLE usuarios ADD COLUMN "authVersion" integer NOT NULL DEFAULT 0, ADD COLUMN "passwordResetHash" varchar(64), ADD COLUMN "passwordResetExpiresAt" timestamptz`);
  await q.query(`CREATE UNIQUE INDEX usuarios_reset_hash_unique ON usuarios ("passwordResetHash") WHERE "passwordResetHash" IS NOT NULL`);
 }
 async down(): Promise<void> { throw new Error('Reversión destructiva deshabilitada; requiere revisión manual.'); }
}
