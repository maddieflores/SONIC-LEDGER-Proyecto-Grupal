// Applies only CU13/CU14. Refuses to apply unrelated pending migrations.
import dataSource from '../dist/data-source.js';
await dataSource.initialize();
try {
  const exists = await dataSource.query("SELECT to_regclass('migrations') AS table_name");
  const applied = exists[0].table_name ? await dataSource.query('SELECT name FROM migrations') : [];
  const known = new Set(applied.map(row => row.name));
  const pending = dataSource.migrations.filter(m => !known.has(m.name || m.constructor.name));
  if (pending.some(m => m.constructor.name !== 'DjSessions1794494000000')) throw new Error('Hay migraciones ajenas al DJ pendientes. Revisa el estado antes de continuar.');
  const result = await dataSource.runMigrations();
  console.log('Migraciones DJ aplicadas:', result.map(m => m.name));
} finally { await dataSource.destroy(); }
