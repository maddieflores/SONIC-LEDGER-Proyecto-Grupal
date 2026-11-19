# Sonic Ledger

Monorepositorio de Sonic Ledger. `main` contiene la versión de referencia para producción y `develop` es la rama de trabajo. Esta publicación no realiza ningún despliegue.

## Estructura y tecnologías

```text
frontend/                React 19, Vite y TypeScript (web)
backend/                 NestJS 12, TypeORM y PostgreSQL (API)
  src/migrations/        Migraciones ejecutables del esquema
  src/seeds/             Semillas de demostración configurables
  uploads/               Archivos de usuarios; excluidos de Git
mobile/                  React Native 0.88, Expo SDK 58 y Expo Router
shared/                  Contratos, clientes de API y utilidades compartidas
ia/                      FastAPI, scikit-learn y conexión local con Ollama
  requirements.lock.txt  Dependencias Python fijadas
database/                Docker Compose de PostgreSQL 16 y Ollama
  migrations/            Documentación; las migraciones están en backend/src/migrations
  seeds/                 Documentación; las semillas están en backend/src/seeds
docs/                    Arquitectura y documentación funcional
scripts/                 Configuración y arranque local en PowerShell
```

Cada aplicación conserva su `package.json`, `package-lock.json` y configuración. El código común de `shared/` debe estar disponible al construir web y móvil: conservar la estructura completa del repositorio en el entorno de compilación.

## Instalación reproducible

Requisitos: Node.js 24, npm, Python 3.12, PowerShell 7 (`pwsh`) para los scripts y Docker con Compose. Ejecutar en la raíz:

```powershell
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix mobile ci
python -m venv ia/.venv
ia/.venv/Scripts/python.exe -m pip install -r ia/requirements.lock.txt
pwsh -File scripts/setup-env.ps1
```

El script conserva los `.env` existentes y genera claves locales para PostgreSQL y JWT. Los archivos `.env.example` de cada servicio describen sus variables sin credenciales reales. En otro sistema operativo se pueden copiar manualmente y completar valores propios; los scripts de arranque de IA suministrados usan las rutas de Windows.

Antes de usar las semillas, configurar `DEMO_PASSWORD` en `backend/.env` con una contraseña exclusiva de pruebas. Las variables opcionales `DEMO_CLIENTE_PASSWORD`, `DEMO_ARTISTA_PASSWORD`, `DEMO_ORGANIZADOR_PASSWORD`, `DEMO_VERIFICADOR_PASSWORD` y `DEMO_ADMIN_PASSWORD` permiten claves distintas por rol. Las semillas solo crean datos de demostración y se ejecutan bajo petición.

## Base de datos y ejecución local

Con Docker iniciado:

```powershell
npm run db:up
npm --prefix backend run migration:run
# Opcional, únicamente para datos de demostración:
npm run seed
```

En terminales separadas, desde la raíz:

```powershell
npm run dev:backend
npm run dev:frontend
npm run dev:mobile
npm run dev:ia
```

| Servicio | Dirección local |
| --- | --- |
| Web | http://localhost:5173 |
| API | http://localhost:3000/api |
| Salud | http://localhost:3000/api/health |
| Swagger API | http://localhost:3000/docs |
| IA / documentación | http://127.0.0.1:8010/docs |
| PostgreSQL | 127.0.0.1:5433, base `sonic_ledger`, usuario `sonic` |
| Ollama en Compose | http://127.0.0.1:11435 |

En `mobile/.env`, establecer `EXPO_PUBLIC_API_URL` con la IP LAN de la computadora para un teléfono físico. Web usa `VITE_API_URL`. Estas variables se incorporan al cliente: no deben contener secretos. Usar un cliente Expo compatible con SDK 58; las funciones nativas pueden requerir un development build. iOS nativo requiere macOS o compilación remota.

El DJ del backend usa `OLLAMA_URL` y `OLLAMA_MODEL` de `backend/.env`; el modelo está vacío en el ejemplo y desactiva la inferencia. Para usar Ollama de Compose, seleccionar su puerto 11435 y un modelo instalado por separado. El servicio Python usa su propio `ia/.env`. No se descargan ni versionan pesos de modelos.

Detener las aplicaciones con Ctrl+C. `npm run db:down` detiene los contenedores y conserva los volúmenes. La base se reconstruye mediante migraciones; `synchronize` está desactivado.

## Validación

```powershell
npm run build
npm --prefix backend test
npm --prefix frontend run lint
npm run check:mobile
npm --prefix mobile run lint
Push-Location ia
./.venv/Scripts/python.exe -m pytest
Pop-Location
```

Las pruebas que requieren servicios externos tienen activación específica; revisar los archivos `*.spec.ts` y la documentación antes de ejecutarlas sobre una base con datos.

## Preparación para despliegues independientes

| Componente | Instalación / compilación | Ejecución o salida |
| --- | --- | --- |
| Web | `npm --prefix frontend ci`; `npm --prefix frontend run build` | Estáticos en `frontend/dist`; configurar fallback SPA y `VITE_API_URL` durante la compilación |
| Backend | `npm --prefix backend ci`; `npm --prefix backend run build` | `npm --prefix backend run start:prod`; configurar `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, `PORT` y los servicios necesarios |
| PostgreSQL | `database/compose.yaml` para desarrollo | En producción usar una instancia persistente y ejecutar `npm --prefix backend run migration:run` con la conexión apropiada |
| Móvil | `npm --prefix mobile ci`; configuración en `mobile/app.json` y `mobile/eas.json` | Construcción y distribución nativas pendientes; configurar `EXPO_PUBLIC_API_URL` antes de compilar |
| IA | `ia/requirements.lock.txt` | Desde `ia/`: `python -m uvicorn app.main:app --host 127.0.0.1 --port 8010` para uso local |

La estructura permite preparar cada componente por separado, pero la aplicación conserva limitaciones de desarrollo: pagos sandbox, correo de recuperación local y cargas multimedia restringidas en producción. Deben resolverse y verificarse antes de un despliegue real. Este repositorio no incluye infraestructura de producción ni publica servicios automáticamente.

## Git y privacidad

Trabajar en `develop` y promover cambios revisados hacia `main`. Se conserva como antecesor el commit inicial original de la aplicación móvil; desde esta publicación, móvil forma parte del repositorio raíz. La copia local de sus metadatos anteriores se conserva en `.local/mobile-git-backup`, excluida de Git.

Se excluyen dependencias instaladas, `.env`, claves, cachés, compilaciones, respaldos, resultados locales de pruebas, cargas de usuarios y bases locales. Los esquemas, migraciones, semillas sintéticas y archivos de dependencias sí se versionan. No utilizar dumps reales para inicializar el entorno.


## Estado de validación de esta publicación

La compilación de backend y web y la comprobación TypeScript de móvil pasaron. El lint web finaliza con advertencias. El lint móvil detecta 12 errores y 9 advertencias preexistentes (principalmente actualizaciones de estado desde efectos); esta publicación conserva las funcionalidades y no corrige esos hallazgos. Las dos pruebas de IA pasaron. Backend: 189 pruebas pasaron y 16 quedaron omitidas al excluir la prueba de concurrencia contra PostgreSQL. La prueba `backend/src/ticketing/concurrency.e2e.spec.ts` requiere una base PostgreSQL de pruebas y no se validó con acceso a la base en esta publicación. Estos pendientes impiden considerar esta revisión una certificación de disponibilidad para producción.

