import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ConciertosEntradas1794490000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS conciertos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        organizador_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        titulo varchar(200) NOT NULL,
        descripcion text NOT NULL DEFAULT '',
        portada_url varchar(500) NULL,
        genero varchar(100) NOT NULL DEFAULT '',
        fecha_inicio timestamptz NOT NULL,
        fecha_fin timestamptz NOT NULL,
        zona_horaria varchar(50) NOT NULL DEFAULT 'America/La_Paz',
        recinto varchar(200) NOT NULL,
        direccion varchar(255) NOT NULL,
        ciudad varchar(100) NOT NULL,
        departamento varchar(100) NOT NULL,
        estado varchar(20) NOT NULL DEFAULT 'BORRADOR',
        inicio_venta timestamptz NULL,
        destacado boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS concierto_artistas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        artista_id uuid NULL REFERENCES artistas(id) ON DELETE SET NULL,
        nombre_artista varchar(100) NOT NULL,
        orden int NOT NULL DEFAULT 1,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE TABLE IF NOT EXISTS concierto_categorias (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        nombre varchar(100) NOT NULL,
        precio numeric(10, 2) NOT NULL DEFAULT 0,
        moneda varchar(10) NOT NULL DEFAULT 'BOB',
        cupo_total int NOT NULL DEFAULT 0,
        cupo_disponible int NOT NULL DEFAULT 0,
        disponible boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS conciertos_estado_fecha_idx
      ON conciertos(estado, fecha_inicio)
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS conciertos_organizador_idx
      ON conciertos(organizador_id)
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS concierto_artistas_concierto_idx
      ON concierto_artistas(concierto_id)
    `);

    await q.query(`
      CREATE INDEX IF NOT EXISTS concierto_categorias_concierto_idx
      ON concierto_categorias(concierto_id)
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Reversión destructiva deshabilitada para preservar el historial de conciertos y entradas.',
    );
  }
}
