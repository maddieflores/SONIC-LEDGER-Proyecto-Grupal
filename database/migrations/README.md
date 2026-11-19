# Migraciones

PostgreSQL se ejecuta en Docker en localhost:5433 y conserva datos en un volumen.
Esta instalacion crea la base sonic_ledger, todavia sin tablas de negocio.
Las migraciones SQL revisadas del proyecto se guardaran aqui; las entidades TypeORM quedan junto al modulo backend correspondiente.
No activar synchronize en produccion ni usar docker compose down -v para detener el desarrollo: borra datos.
