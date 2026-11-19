# Sonic Ledger — entorno manual local

Preparado el 15 de noviembre de 2026. No se reinstalaron dependencias, no se aplicaron nuevas migraciones y no se reinicializó la base de datos.

## Direcciones

| Servicio | Dirección | Comprobación |
| --- | --- | --- |
| Web React/Vite | http://localhost:5173 | Carga y navegación visibles en navegador |
| NestJS | http://localhost:3000/api/health | HTTP 200 y conexión PostgreSQL real |
| Swagger | http://localhost:3000/docs | API del proyecto |
| PostgreSQL existente | 127.0.0.1:5433 | Conexión real; migraciones ya aplicadas |
| Expo/Metro | http://192.168.1.3:8081 | Manifiesto SDK 58 y bundle Android HTTP 200 |
| Backend desde Android | http://192.168.1.3:3000/api | `mobile/.env`, IP de Wi-Fi detectada |
| Ollama nativo | http://127.0.0.1:11434 | Modelo autorizado instalado; API disponible |
| IA auxiliar histórica | http://127.0.0.1:8010/health | Servicio existente requerido por health; sin cargar modelos adicionales |

La IP LAN se detecta otra vez al ejecutar el lanzador. Si cambia la red, ejecutar Start antes de abrir el teléfono. La base de datos sigue enlazada exclusivamente a loopback; no se expuso a internet.

## Iniciar después de encender la laptop

En PowerShell:

```powershell
cd 'C:\Proyectos\Proyecto Final'
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\sonic-dev.ps1 Start
```

El lanzador reutiliza puertos abiertos y evita duplicar sus procesos, incluso si todavía están arrancando. Inicia PostgreSQL con el Compose existente solo si 5433 no escucha; no crea otra base ni elimina volúmenes. No ejecuta migraciones ni semillas. Para backend usa `npm run start:dev`, Vite `npm run dev` y Expo `npm run start`, con puertos explícitos para evitar cambios silenciosos.

Los servidores se inician con procesos Windows persistentes ocultos, separados de la ejecución temporal de Codex. Los logs y PID propios se conservan en `.local/dev/`, excluido del repositorio. Los logs no imprimen variables privadas. Esperar unos segundos tras Start para que terminen las compilaciones iniciales.

```powershell
# Ver puertos y direcciones reales
.\scripts\sonic-dev.ps1 Status

# Seguir un log, sin detener su servidor al salir del seguimiento
Get-Content .\.local\dev\backend.log -Tail 30 -Wait
Get-Content .\.local\dev\expo.log -Tail 30 -Wait

# Solo cuando termines tus pruebas: detener procesos propios del lanzador
.\scripts\sonic-dev.ps1 Stop

# Liberar el modelo de RAM sin cerrar la API Ollama ni borrar el modelo
ollama stop LiquidAI/lfm2.5-1.2b-instruct:q4_k_m
```

Stop verifica PID, ruta y comando antes de detener cada árbol de procesos propio. No detiene PostgreSQL ni la API Ollama, ni procesos que no haya creado este lanzador. No borra datos. Si un puerto está ocupado por otro proyecto, revisar el proceso antes de reutilizarlo; el script no cambia puertos automáticamente.

## Abrir Android físico

1. Conectar teléfono y laptop a la misma Wi-Fi, sin aislamiento de clientes.
2. Usar Expo Go compatible con **SDK 58**. El servidor se inició explícitamente en modo `--go`; no se generó APK.
3. Escanear [este QR](../tmp/sonic-expo-qr.png) desde Expo Go o abrir `exp://192.168.1.3:8081`.
4. Si tu Expo Go no admite SDK 58, usar un development build compatible ya disponible. El repositorio tiene perfil EAS de desarrollo, pero no se construyó ni instaló una app nativa nueva en esta sesión.
5. Si no conecta, abrir en el navegador del teléfono `http://192.168.1.3:3000/api/health`. Si no responde, revisar Wi-Fi/aislamiento y permisos del firewall de Windows para Node en la red privada. No se cambiaron reglas globales de firewall.

`localhost` del teléfono no apunta a la laptop. La API móvil está configurada por LAN. El bundle servido contiene esa dirección y la pantalla DJ. La lectura del manifiesto y compilación no equivalen a una prueba física: audio, cámara/QR y permisos del teléfono siguen pendientes.

## Recorrido manual

Usar las cuentas existentes. Las cuentas demo cliente y verificador se comprobaron con las contraseñas locales ya configuradas, sin mostrarlas, cambiarlas ni ejecutar seed.

### Web

1. `/registro` si deseas crear una cuenta; `/iniciar-sesion` para entrar con una existente.
2. `/explorar`: catálogo, reproducción y recomendaciones CU12.
3. `/dj`: generar **“Quiero una canción”**, agregar una, **“Sin electrónica”**, revisar chips y cola, quitar/reordenar/sustituir y guardar como playlist. Probar también **“Pop sin electrónica”**: puede haber escasez real.
4. `/mi-musica`: recuperar playlists; cerrar sesión y entrar otra vez para verificar persistencia.
5. `/conciertos`: detalle y flujo de compra sandbox; `/mis-entradas`: ticket y QR. En esta sesión solo se comprobaron lecturas/status; no se ejecutó una compra ni un reembolso.
6. `/estadisticas-musicales`: consultar estadísticas.

### Android

Entrar, abrir Explorar, reproducir y revisar recomendaciones. Desde Inicio abrir DJ, generar/ajustar/guardar y recuperar la playlist en Mi música. Probar entradas digitales; con una cuenta VERIFICADOR, abrir Control de acceso QR y conceder permiso de cámara en el teléfono cuando corresponda.

“Más tranquilo” y “Más energético” se reconocen, pero el catálogo actual no acredita energía/calma: el sistema rechaza estos cambios con un mensaje y conserva la sesión. No atribuye propiedades inventadas a canciones.

## Evidencia y pendientes

- Salud, login cliente/verificador, catálogo, recomendaciones, DJ, playlists, conciertos, tickets y estadísticas devolvieron 200: `servicios-smoke-results.json`.
- Pantallas de acceso y DJ revisadas visualmente en navegador. No se introdujeron credenciales en el navegador ni se simularon compras por UI.
- Bundle Android y LAN verificados: `expo-android-smoke.json`. SDK instalado: Expo 58.0.24. La comprobación de dependencias usó mapa local porque el entorno de herramientas no accedió al endpoint de versiones; no se instalaron actualizaciones.
- Pruebas del DJ y distinción entre calidad del modelo/sistema: [informe real](CU13-CU14-PRUEBAS-REALES.md).
- Pendientes: teléfono físico, escucha audible, cámara/QR, compra sandbox completa por UI, y mayor cobertura de peticiones naturales fuera de los casos medidos. El catálogo local es pequeño; no se añadieron canciones para alterar los resultados.

Para resolver el arranque web se apartaron únicamente seis artefactos compilados antiguos de `shared/` que ocultaban los fuentes TypeScript. Se conservaron en `.local/generated-shared/`. No se cambiaron funciones de pagos, reembolsos, tickets ni catálogo.

