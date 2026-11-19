import type { MigrationInterface, QueryRunner } from 'typeorm';
export class PerfilArtistico1794485000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `ALTER TABLE artistas ADD COLUMN cover_url varchar(500), ADD COLUMN ciudad varchar(80) NOT NULL DEFAULT '', ADD COLUMN pais varchar(80) NOT NULL DEFAULT '', ADD COLUMN identidad jsonb NOT NULL DEFAULT '[]'::jsonb, ADD COLUMN redes jsonb NOT NULL DEFAULT '{}'::jsonb`,
    );
    await q.query(
      `CREATE TABLE artistas_generos (artista_id uuid NOT NULL REFERENCES artistas(id) ON DELETE CASCADE, genero_id uuid NOT NULL REFERENCES generos(id) ON DELETE RESTRICT, PRIMARY KEY (artista_id, genero_id))`,
    );
    await q.query(
      `CREATE INDEX artistas_generos_genero_idx ON artistas_generos(genero_id)`,
    );
  }
  async down(): Promise<void> {
    throw new Error(
      'Reversión automática deshabilitada para preservar perfiles artísticos.',
    );
  }
}
