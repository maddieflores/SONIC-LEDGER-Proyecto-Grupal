# Integración controlada de Audius

Audius complementa Explorar web y móvil. Las canciones propias conservan UUID y fuente LOCAL; las externas usan `audius:<id>` y fuente AUDIUS. No se guardan pistas ni artistas externos en PostgreSQL. No se modificaron autenticación, roles, CU05 ni las rutas de administración. No se implementaron CU06/CU09/CU10/CU11.

## Protección y archivos

Respaldo previo recuperable: `tmp/audius-backup-20261113-233242/`. Conserva backend/src, frontend/src, shared, mobile/src, mobile/app.json y manifiestos/configuración de ejemplo afectados. Para recuperar un archivo, copiar su versión desde esa carpeta a la misma ruta relativa del proyecto; comparar antes si hubo ediciones posteriores. Los archivos nuevos de Audius se identifican abajo. No se inicializó Git ni se operó sobre el repositorio Git anidado de mobile. No se ejecutaron migraciones ni escrituras/eliminaciones en PostgreSQL.

Archivos incorporados del módulo aislado: `backend/src/integrations/audius/audius.{client,controller,dto,mapper,module,service,types}.ts`. Adaptados al Nest existente, sin dependencias nuevas. Nuevos: `audio.controller.ts`, `destination.ts`, `security.spec.ts`, `backend/scripts/verify-audius.mjs` y este informe.

Archivos ajustados: `backend/src/app.module.ts`, `backend/src/catalog/catalog.service.ts`, `backend/.env.example`, `shared/catalog.ts`, `shared/playback.ts`, `frontend/src/Catalog.tsx`, `mobile/src/features/catalog/CatalogScreen.tsx`, `mobile/src/features/playback/NativePlayback.tsx`. El motor web y su única instancia permanecen intactos; el resolvedor compartido selecciona el endpoint por ID/fuente. La lógica móvil de audio también conserva la misma instancia.

## Endpoints

Todos requieren la sesión existente. El prefijo `/api` se aplica una sola vez. Se usa `/auth/` para reutilizar la cookie HttpOnly actual, cuyo alcance ya es `/api/auth`:

- GET `/api/auth/integrations/audius/trending`
- GET `/api/auth/integrations/audius/search?query=house&type=all` (tracks, artists o all)
- GET `/api/auth/integrations/audius/tracks/:id`
- GET `/api/auth/integrations/audius/tracks/:id/stream` (resolución temporal)
- GET/HEAD `/api/auth/integrations/audius/tracks/:id/audio` (transmisión autorizada sin almacenamiento)
- GET `/api/auth/integrations/audius/artists/:id`
- GET `/api/auth/integrations/audius/artists/:id/tracks`

Se comprueban gating, access.stream, eliminación y disponibilidad antes de resolver cada reproducción. La resolución de audio no utiliza metadatos de permisos en caché. No se conservan firmas en caché ni se incluyen claves API en URLs. El servidor transmite audio sin persistirlo; Range y encabezados de audio se conservan. Se interrumpe la solicitud externa al desconectarse el cliente.

Cada redirección se sigue manualmente, con límite de saltos. Solo HTTPS sin credenciales ni puertos alternativos y hosts oficiales `api.audius.co`, subdominios `.audius.co` y el host exacto observado `validator.eeba4a6ca56a0d87af802270217c2a51.r2.cloudflarestorage.com`. No se acepta una URL del usuario y no hay proxy abierto. Otros nodos se rechazan; no se habilitó todo Cloudflare R2. Los JWT locales jamás se envían a las portadas externas.

## Catálogo e interfaces

Explorar conserva sus listas compactas y botones circulares. La fuente se indica junto al artista. La búsqueda consulta pistas y artistas externos, y agrega pistas del primer artista coincidente. El detalle y el perfil público web admiten identificadores Audius; el perfil externo es una consulta de lectura y no un perfil artístico propio. Las restricciones se muestran como audio no disponible. No se incorporaron estadísticas externas al diseño.

La caída del proveedor deja visibles y reproducibles los resultados locales y muestra un aviso. El filtro por género propio sigue aplicado solo al catálogo LOCAL: los géneros externos no se insertan en la tabla local. Audius usa offset y no entrega un total exacto en este contrato; se cuentan resultados recibidos y se permite avanzar si la página externa está completa. El perfil externo web muestra hasta 50 pistas; no pretende implementar la navegación completa de Audius.

## Configuración y ejecución

Valores seguros por defecto, también documentados en backend/.env.example:

```dotenv
AUDIUS_BASE_URL=https://api.audius.co/v1
AUDIUS_APP_NAME=SonicLedger
AUDIUS_TIMEOUT_MS=8000
# AUDIUS_API_KEY=opcional, solo servidor
```

No se necesita clave para la lectura pública verificada. Si se configura una, se envía exclusivamente por encabezado a la API oficial. No se debe poner en VITE_* ni EXPO_PUBLIC_*.

Desde la raíz, en terminales independientes:

```powershell
npm run dev:backend
npm run dev:frontend
npm run dev:mobile
```

Abrir web en http://localhost:5173/explorar e iniciar sesión. En Android, abrir el cliente Expo existente y Explorar; EXPO_PUBLIC_API_URL debe usar la IP LAN del equipo con puerto 3000 y `/api`, nunca localhost del teléfono. El backend necesita salida HTTPS hacia Audius.

## Verificación

- 37 pruebas backend aprobadas en 10 archivos, incluidas restricciones de streaming y rechazo de destinos no permitidos.
- Consulta real, búsqueda de canciones/artistas, perfil de artista y bytes de audio externos mediante la API integrada. Sin mocks en esta comprobación.
- Navegador real: decodificación y progreso Audius, cola LOCAL/AUDIUS, misma instancia entre rutas y reproducción LOCAL ante fallo externo.
- Expo web con expo-audio: reproducción real Audius, pausa, progreso, seek, cola y mini persistente; una sola instancia audible. También se verificó el WAV LOCAL.
- CU07 y CU08 conservan los scripts de regresión de catálogo, búsqueda, filtros, portadas, autenticación, streaming Range y protección de borradores. CU05 mantiene sus pruebas de rol/propiedad del backend.
- Backend/web build y lint; móvil TypeScript/lint. Exportación Android Hermes de 1174 módulos.

El script `backend/scripts/verify-audius.mjs` usa el fixture local ignorado de CU08 y no imprime credenciales. Ejecutar desde backend después de su build. Las pruebas de navegador están en `tmp/verify-audius-{web,mobile}.cjs`; capturas móviles en `tmp/audius-mobile-{full,mini}.png`.

## Límites

Android físico y build de APK no verificados: generar un bundle no los sustituye. La prueba multimedia móvil ejecutada fue Expo web. La reproducción Android continúa en primer plano, sin servicio de fondo ni pantalla bloqueada, como CU08. Expo web mantiene un blob temporal de audio durante la reproducción y lo revoca al cambiar/cerrar; no es una descarga permanente. El navegador web principal y Android usan transmisión desde el endpoint autenticado. Un nuevo host de distribución de Audius requiere revisión explícita de la lista permitida, nunca apertura automática del proxy.
