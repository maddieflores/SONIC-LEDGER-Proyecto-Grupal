import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PlaylistsYFavoritos1794488000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        nombre varchar(150) NOT NULL,
        descripcion varchar(2000) NOT NULL DEFAULT '',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS playlists_usuario_id_idx ON playlists(usuario_id)`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS playlist_tracks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        playlist_id uuid NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
        track_id varchar(100) NOT NULL,
        source varchar(10) NOT NULL DEFAULT 'LOCAL',
        posicion integer NOT NULL,
        "addedAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT playlist_tracks_unique_track UNIQUE (playlist_id, track_id)
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS playlist_tracks_playlist_pos_idx ON playlist_tracks(playlist_id, posicion)`);

    await q.query(`
      CREATE TABLE IF NOT EXISTS favorite_tracks (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        track_id varchar(100) NOT NULL,
        source varchar(10) NOT NULL DEFAULT 'LOCAL',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT favorite_tracks_unique_user_track UNIQUE (usuario_id, track_id)
      )
    `);
    await q.query(`CREATE INDEX IF NOT EXISTS favorite_tracks_usuario_idx ON favorite_tracks(usuario_id, "createdAt" DESC)`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Reversión destructiva deshabilitada para preservar bibliotecas de usuarios.',
    );
  }
}
