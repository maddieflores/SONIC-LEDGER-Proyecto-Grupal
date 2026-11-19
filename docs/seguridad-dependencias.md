# Revision inicial de dependencias

La instalacion final de Expo SDK 58 con sus herramientas de lint reporto ocho avisos moderados relacionados entre si:
minimatch -> @expo/fingerprint -> expo.
La misma dependencia afecta tambien a herramientas @typescript-eslint.

Aviso: https://github.com/advisories/GHSA-g3hv-75wg-m249
Describe posible denegacion de servicio mediante patrones glob preparados especialmente.

No se aplico npm audit fix --force: npm propone bajar Expo a 52.0.49, incompatible con la base SDK 58 creada.
Se ejecuto npm audit fix sin force; los ocho avisos permanecen y requieren seguimiento de una actualizacion compatible o una migracion evaluada.
No hay que interpretar la ausencia de avisos altos/criticos en esta consulta como certificacion de seguridad.
Revisar actualizaciones compatibles del SDK antes de publicar y evitar patrones glob no confiables en herramientas de compilacion.
