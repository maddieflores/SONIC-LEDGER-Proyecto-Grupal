import type { MigrationInterface, QueryRunner } from 'typeorm';
export class CreateUsuarios1794480000000 implements MigrationInterface {
 async up(q: QueryRunner): Promise<void> {
  await q.query(`CREATE TYPE usuarios_role_enum AS ENUM ('usuario', 'admin')`);
  await q.query(`CREATE TABLE usuarios (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), username varchar(60) NOT NULL, email varchar(254) NOT NULL UNIQUE, "passwordHash" varchar NOT NULL, role usuarios_role_enum NOT NULL DEFAULT 'usuario', "createdAt" timestamptz NOT NULL DEFAULT now(), CONSTRAINT email_normalized CHECK (email = lower(trim(email))))`);
 }
 async down(): Promise<void> { throw new Error('Reversión destructiva deshabilitada; requiere revisión manual.'); }
}
