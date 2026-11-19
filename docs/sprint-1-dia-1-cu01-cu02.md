# Sonic Ledger — Sprint 1, día 1: CU01 y CU02

Implementados registro, inicio de sesión, consulta del usuario y cierre de sesión en NestJS, React y Expo. El onboarding conserva sus componentes y diseño; el punto de entrada móvil ahora restaura la sesión guardada.

## Archivos

Creados:
- `backend/src/auth/{usuario.entity,auth.dto,auth.service,auth.controller,auth.module,auth.spec}.ts`.
- `backend/src/data-source.ts` y `backend/src/migrations/1794480000000-CreateUsuarios.ts`.
- `frontend/src/Auth.tsx` y `frontend/src/auth-api.ts`.
- `mobile/src/features/auth/AuthScreen.tsx`, `mobile/src/services/auth.ts`, `mobile/src/services/session.ts`, `mobile/src/app/inicio.tsx`.
- `tmp/verify-auth.cjs` (comprobación reproducible del entorno local de prueba) y `tmp/inspect-auth.cjs` (diagnóstico visual).

Modificados:
- `backend/src/app.module.ts`, `backend/src/main.ts`, `backend/package.json`.
- `frontend/src/App.tsx`, `frontend/src/App.css`.
- `mobile/src/app/iniciar-sesion.tsx`, `mobile/src/app/registro.tsx`, `mobile/src/app/index.tsx`.

## API y sesión

| Método | Endpoint | Resultado |
| --- | --- | --- |
| POST | `/api/auth/register` | Registro con username, email, password y acceptedTerms=true; rol público fijo usuario |
| POST | `/api/auth/login` | JWT bearer para móvil; cookie HttpOnly para client=web |
| GET | `/api/auth/me` | Usuario autenticado por JWT bearer o cookie; 401 sin sesión válida |
| POST | `/api/auth/logout` | Borra la cookie web; el móvil elimina sus credenciales locales |

Email normalizado, unicidad en PostgreSQL, contraseña bcrypt con coste 12 y máximo de 72 bytes; respuestas sin hash. JWT firmado HS256 con emisor y audiencia, duración de una hora. JWT_SECRET obligatorio, aleatorio y de al menos 32 caracteres. No se añadieron dependencias.

Web: cookie HttpOnly, SameSite=Strict y Secure en producción. Recordarme añade Max-Age de una hora; sin marcar se usa cookie de sesión. Desplegar web y API en el mismo sitio y usar HTTPS en producción. CORS permite credenciales exclusivamente para CORS_ORIGINS configurados.

Expo nativo: token en memoria; Recordarme lo guarda en SecureStore. El punto de entrada recupera ese token. Expo Web usa memoria y no persiste credenciales en localStorage. Las contraseñas nunca se guardan en el cliente. Una sesión expirada redirige a login; los errores de conexión se muestran sin tratarlos como credenciales inválidas.

No hay lista de revocación: un JWT copiado continúa vigente hasta su expiración. Logout elimina el acceso desde el cliente, no invalida ese JWT en el servidor.

Pantallas web y móvil: `/registro`, `/iniciar-sesion`, `/inicio` (destino autenticado provisional con logout). Validación, errores de conexión/servidor, carga, confirmación de registro y visibilidad de contraseña.

## Migración

Aplicada en PostgreSQL local el 12 de noviembre de 2026: `CreateUsuarios1794480000000`. Crea tabla usuarios, enum de roles e índice único de correo. `synchronize: false` permanece. No se borraron datos. La reversión destructiva está deshabilitada; la migración debe aplicarse por separado en otros entornos.

## Verificaciones ejecutadas

- Backend: build, lint y Vitest: 5 pruebas aprobadas en 2 archivos. Incluyen registro, hash, duplicado, campos privilegiados, términos, contraseña, credenciales inválidas, JWT ausente/corrupto/válido, cookie HttpOnly persistente y logout sin falsa revocación.
- Web: build TypeScript/Vite y lint aprobados.
- Móvil: TypeScript y lint aprobados.
- Edge sin interfaz contra PostgreSQL real: registro, login, recarga con cookie, logout, duplicado 409, credenciales inválidas 401 y ruta protegida con/sin JWT.
- Web: capturas de ambas pantallas en 1440x900, 820x1180 y 360x800; sin desbordamiento horizontal.
- Expo Web: ambas pantallas a 360x740; registro, login, consulta /me y logout reales; sin errores JavaScript ni desbordamiento horizontal. Se corrigió una capa de fondo que tapaba inputs en web.
- Revisión visual de las capturas de login web, registro web, registro móvil y login móvil. Capturas en `tmp/auth-*.png`.

Las pruebas reales conservan cuentas identificadas por correos `sprint1.<timestamp>@example.com`, `mobile.<timestamp>@example.com` y cuentas de diagnóstico `test.*`/`cookie.*`; no se borraron datos.

## Ejecutar desde la raíz del proyecto

En terminales separadas:

```powershell
npm run db:up
npm --prefix backend run migration:run
npm run dev:backend
npm run dev:frontend
npm run dev:mobile
```

Configurar previamente `.env` a partir de los ejemplos existentes. Frontend: VITE_API_URL=http://localhost:3000/api. Expo en teléfono: EXPO_PUBLIC_API_URL=http://<IP-LAN-DE-LA-PC>:3000/api. PC y teléfono deben poder comunicarse; localhost en teléfono no apunta a la PC. Para Expo Web, añadir su origen exacto a CORS_ORIGINS y reiniciar NestJS.

Comprobaciones:

```powershell
npm --prefix backend run build
npm --prefix backend run lint
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend run lint
npm --prefix mobile run typecheck
npm --prefix mobile run lint
```

Durante la verificación el backend previo ocupaba 3000 y no incluía las rutas nuevas. Se usaron instancias aisladas en API 3002, web 5176 y Expo Web 8084, sin cambiar los .env ni detener procesos anteriores. Para usar la configuración habitual, reiniciar el backend anterior con el código actualizado. El script `node tmp/verify-auth.cjs` espera esos puertos de prueba y el runtime Playwright local indicado en su primera línea.

## Pendientes y límites

- Falta el recurso individual de una persona con audífonos para login móvil y registro web. Se reutilizaron los audífonos existentes para login y ondas CSS para registro, sin usar la captura completa ni inventar rutas. La fidelidad visual a la referencia queda limitada por ese recurso.
- Pendiente validación en Android/iOS real: teclado abierto, Safe Area, almacenamiento seguro, reinicio de app y dispositivo pequeño. Expo Web no sustituye esas pruebas.
- El contenido legal definitivo de términos y privacidad no fue proporcionado; la aceptación se valida, sin publicar textos legales inventados.
- No se implementaron CU03–CU05, proveedores sociales, perfiles, artistas ni canciones.
