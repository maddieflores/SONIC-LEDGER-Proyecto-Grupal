import type { MigrationInterface, QueryRunner } from 'typeorm';

export class TicketingYValidaciones1794491000000 implements MigrationInterface {
  async up(q: QueryRunner): Promise<void> {
    // 1. Órdenes de compra
    await q.query(`
      CREATE TABLE IF NOT EXISTS ordenes_compra (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        estado varchar(20) NOT NULL DEFAULT 'PENDIENTE',
        total numeric(10, 2) NOT NULL DEFAULT 0,
        moneda varchar(10) NOT NULL DEFAULT 'BOB',
        expira_en timestamptz NOT NULL,
        operacion_id varchar(100) NOT NULL UNIQUE,
        proveedor_pago varchar(50) NULL DEFAULT 'MOCK',
        pago_transaccion_id varchar(100) NULL,
        pago_estado varchar(30) NULL,
        confirmada_en timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 2. Detalle de ordenes
    await q.query(`
      CREATE TABLE IF NOT EXISTS orden_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        orden_id uuid NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
        categoria_id uuid NOT NULL REFERENCES concierto_categorias(id) ON DELETE CASCADE,
        cantidad int NOT NULL,
        precio_unitario numeric(10, 2) NOT NULL,
        subtotal numeric(10, 2) NOT NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 3. Reservas temporales de cupo
    await q.query(`
      CREATE TABLE IF NOT EXISTS reservas_cupo (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        orden_id uuid NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
        categoria_id uuid NOT NULL REFERENCES concierto_categorias(id) ON DELETE CASCADE,
        cantidad int NOT NULL,
        expira_en timestamptz NOT NULL,
        liberada boolean NOT NULL DEFAULT false,
        confirmada boolean NOT NULL DEFAULT false,
        "createdAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 4. Tickets individuales emitidos
    await q.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        orden_id uuid NOT NULL REFERENCES ordenes_compra(id) ON DELETE CASCADE,
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        categoria_id uuid NOT NULL REFERENCES concierto_categorias(id) ON DELETE CASCADE,
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        estado varchar(20) NOT NULL DEFAULT 'VIGENTE',
        codigo_publico varchar(50) NOT NULL UNIQUE,
        qr_token varchar(120) NOT NULL UNIQUE,
        fecha_emision timestamptz NOT NULL DEFAULT now(),
        fecha_utilizado timestamptz NULL,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `);

    // 5. Asignación de verificadores a conciertos
    await q.query(`
      CREATE TABLE IF NOT EXISTS concierto_verificadores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        asignado_por uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        activo boolean NOT NULL DEFAULT true,
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT uq_concierto_verificador UNIQUE (concierto_id, usuario_id)
      )
    `);

    // 6. Registro de validaciones de ingreso
    await q.query(`
      CREATE TABLE IF NOT EXISTS ticket_validaciones (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id uuid NULL REFERENCES tickets(id) ON DELETE SET NULL,
        concierto_id uuid NOT NULL REFERENCES conciertos(id) ON DELETE CASCADE,
        verificador_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
        resultado varchar(30) NOT NULL,
        motivo varchar(255) NULL,
        fecha_validacion timestamptz NOT NULL DEFAULT now()
      )
    `);

    // Índices de búsqueda y concurrencia
    await q.query(`CREATE INDEX IF NOT EXISTS ordenes_compra_usuario_idx ON ordenes_compra(usuario_id)`);
    await q.query(`CREATE INDEX IF NOT EXISTS ordenes_compra_concierto_idx ON ordenes_compra(concierto_id)`);
    await q.query(`CREATE INDEX IF NOT EXISTS tickets_usuario_idx ON tickets(usuario_id)`);
    await q.query(`CREATE INDEX IF NOT EXISTS tickets_concierto_idx ON tickets(concierto_id)`);
    await q.query(`CREATE INDEX IF NOT EXISTS tickets_qr_token_idx ON tickets(qr_token)`);
    await q.query(`CREATE INDEX IF NOT EXISTS concierto_verificadores_lookup_idx ON concierto_verificadores(concierto_id, usuario_id, activo)`);
    await q.query(`CREATE INDEX IF NOT EXISTS ticket_validaciones_ticket_idx ON ticket_validaciones(ticket_id)`);
  }

  async down(): Promise<void> {
    throw new Error(
      'Reversión destructiva deshabilitada para preservar el historial de tickets y transacciones.',
    );
  }
}
