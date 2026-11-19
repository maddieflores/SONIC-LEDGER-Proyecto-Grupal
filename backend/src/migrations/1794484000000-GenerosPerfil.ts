import type { MigrationInterface, QueryRunner } from 'typeorm';
export class GenerosPerfil1794484000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      `INSERT INTO generos (nombre) VALUES ('Pop'), ('Rock'), ('Electrónica'), ('Indie'), ('Reguetón') ON CONFLICT DO NOTHING`,
    );
  }
  async down(): Promise<void> {
    throw new Error('No se eliminan géneros que pueden estar en uso.');
  }
}
