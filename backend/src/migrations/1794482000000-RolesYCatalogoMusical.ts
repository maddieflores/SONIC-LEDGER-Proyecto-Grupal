import type { MigrationInterface, QueryRunner } from 'typeorm';

export class RolesYCatalogoMusical1794482000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // 1. Tablas de roles y relación normalizada usuarios_roles
    await q.query(`
      CREATE TABLE roles (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar(30) NOT NULL UNIQUE,
        descripcion varchar(255),
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await q.query(`
      INSERT INTO roles (nombre, descripcion) VALUES
        ('CLIENTE', 'Rol inicial del registro público y oyente general'),
        ('ARTISTA', 'Usuario con perfil artístico habilitado'),
        ('ORGANIZADOR', 'Acceso autorizado a gestión de conciertos'),
        ('VERIFICADOR', 'Acceso autorizado a validar entradas de eventos asignados'),
        ('ADMIN', 'Administrador del sistema')
    `);

    await q.query(`
      CREATE TABLE usuarios_roles (
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        rol_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
        "assignedAt" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (usuario_id, rol_id)
      )
    `);

    await q.query(`CREATE INDEX usuarios_roles_usuario_id_idx ON usuarios_roles(usuario_id)`);
    await q.query(`CREATE INDEX usuarios_roles_rol_id_idx ON usuarios_roles(rol_id)`);

    // 2. Migración segura de roles existentes hacia usuarios_roles
    await q.query(`
      INSERT INTO usuarios_roles (usuario_id, rol_id)
      SELECT u.id, r.id
      FROM usuarios u
      CROSS JOIN roles r
      WHERE u.role = 'usuario' AND r.nombre = 'CLIENTE'
      ON CONFLICT DO NOTHING
    `);

    await q.query(`
      INSERT INTO usuarios_roles (usuario_id, rol_id)
      SELECT u.id, r.id
      FROM usuarios u
      CROSS JOIN roles r
      WHERE u.role = 'admin' AND r.nombre IN ('ADMIN', 'CLIENTE')
      ON CONFLICT DO NOTHING
    `);

    // 3. Estrategia de transición para la columna anterior en usuarios (sin borrarla)
    await q.query(`ALTER TABLE usuarios ALTER COLUMN role DROP NOT NULL`);
    await q.query(`ALTER TABLE usuarios ALTER COLUMN role SET DEFAULT NULL`);

    // 4. Catálogo musical: Artistas
    await q.query(`
      CREATE TABLE artistas (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL UNIQUE REFERENCES usuarios(id) ON DELETE RESTRICT,
        nombre_artistico varchar(100) NOT NULL,
        biografia text,
        avatar_url varchar(500),
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX artistas_nombre_artistico_unique ON artistas (lower(trim(nombre_artistico)))`);

    // 5. Catálogo musical: Géneros
    await q.query(`
      CREATE TABLE generos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nombre varchar(50) NOT NULL,
        descripcion text,
        activo boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE UNIQUE INDEX generos_nombre_unique ON generos (lower(trim(nombre)))`);

    // 6. Catálogo musical: Lanzamientos
    await q.query(`CREATE TYPE lanzamiento_tipo_enum AS ENUM ('SINGLE', 'EP', 'ALBUM')`);
    await q.query(`CREATE TYPE lanzamiento_estado_enum AS ENUM ('borrador', 'publicado')`);

    await q.query(`
      CREATE TABLE lanzamientos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        artista_id uuid NOT NULL REFERENCES artistas(id) ON DELETE CASCADE,
        titulo varchar(150) NOT NULL,
        tipo lanzamiento_tipo_enum NOT NULL,
        portada_url varchar(500),
        fecha_lanzamiento timestamptz,
        estado lanzamiento_estado_enum NOT NULL DEFAULT 'borrador',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX lanzamientos_artista_id_idx ON lanzamientos (artista_id)`);
    await q.query(`CREATE INDEX lanzamientos_estado_idx ON lanzamientos (estado)`);

    // 7. Catálogo musical: Canciones
    await q.query(`CREATE TYPE cancion_estado_enum AS ENUM ('borrador', 'publicado')`);

    await q.query(`
      CREATE TABLE canciones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        artista_id uuid NOT NULL REFERENCES artistas(id) ON DELETE CASCADE,
        lanzamiento_id uuid REFERENCES lanzamientos(id) ON DELETE SET NULL,
        genero_id uuid REFERENCES generos(id) ON DELETE SET NULL,
        titulo varchar(150) NOT NULL,
        archivo_audio_url varchar(500) NOT NULL,
        portada_url varchar(500),
        duracion_segundos integer CHECK (duracion_segundos IS NULL OR duracion_segundos > 0),
        estado cancion_estado_enum NOT NULL DEFAULT 'borrador',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await q.query(`CREATE INDEX canciones_artista_id_idx ON canciones (artista_id)`);
    await q.query(`CREATE INDEX canciones_lanzamiento_id_idx ON canciones (lanzamiento_id)`);
    await q.query(`CREATE INDEX canciones_genero_id_idx ON canciones (genero_id)`);
    await q.query(`CREATE INDEX canciones_estado_idx ON canciones (estado)`);
  }

  async down(): Promise<void> {
    throw new Error('Reversión destructiva deshabilitada; requiere revisión manual.');
  }
}
