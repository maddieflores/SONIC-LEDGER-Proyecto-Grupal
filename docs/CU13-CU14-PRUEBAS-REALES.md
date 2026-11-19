# CU13 / CU14 — corrección y pruebas reales

Fecha: **15 de noviembre de 2026**, America/La_Paz.

## Resultado

**Sistema completo: 12 pruebas reales aprobadas, 0 fallidas, 0 omitidas.** Sin mocks de Ollama, CU12, catálogo, autenticación o PostgreSQL. Se conservaron las aserciones de las pruebas reales. Además: **50 regresiones DJ/CU12 aprobadas** (40 DJ y 10 CU12).

**Modelo sin validación: 0/5 coincidencias exactas** en las cinco solicitudes de interpretación medidas. No es una estimación general de precisión: Liquid AI sigue proponiendo campos espurios. La mejora corresponde al sistema híbrido que valida evidencia antes de modificar filtros o cola. Las salidas originales se conservan.

Entorno manual iniciado; direcciones y recuperación en [ARRANQUE-MANUAL.md](ARRANQUE-MANUAL.md).

## Corrección focalizada

- `ground-intent.ts` contrasta la interpretación con la petición: rechaza campos contradictorios/sin evidencia y conserva géneros, exclusiones y cantidades explícitas. Los campos no solicitados quedan en null para que el merge preserve restricciones anteriores.
- El modelo sigue siendo obligatorio: se ejecuta realmente y su JSON se valida estrictamente. Sus errores de red/esquema no se sustituyen por sesiones prefabricadas. Propone también géneros/actividades fuera del vocabulario local, que solo se conservan con evidencia literal; una prueba de Bossa nova/conducir verifica esta contribución.
- No hay tabla de respuestas para peticiones completas ni canciones inventadas. Las reglas deterministas se documentan como validación del sistema, no como precisión del modelo.
- Se separan géneros incluidos/excluidos, actividad, estado mood, cambio relativo intensityChange, cantidad y acción. intensityChange es transitorio; el estado persistente sigue separado del parche.
- removeExcludedGenres solo levanta exclusiones expresas. Una lista vacía inventada no llega a la sesión; agregar conserva los filtros anteriores.
- `dj-selector.ts` reutiliza **TrackSelectorService de CU12**, junto con los filtros estrictos adicionales del DJ. No se creó otro recomendador/ranking.
- Pistas LOCAL requieren audio existente y publicado; AUDIUS requiere metadatos disponibles. CU08/CU09 no cambiaron sus funciones en esta corrección.

## Resultados finales

| Caso | Resultado | Tiempo |
| --- | --- | --- |
| Disponibilidad del modelo | Aprobado | 0,16 s |
| Rock para entrenar, sin energía inventada | Aprobado tras validación | 4,30 s |
| Pop sin electrónica | Aprobado tras validación | 3,86 s |
| Relajante sin géneros inventados | Aprobado tras validación | 4,27 s |
| Favoritas sin filtros adicionales | Aprobado tras validación | 4,27 s |
| Agregar cinco conservando filtros | Aprobado tras validación | 4,35 s |
| Generación HTTP con catálogo real | Aprobado | 16,13 s |
| Agregar realmente una canción | Aprobado | 4,06 s |
| Excluir electrónica de la cola | Aprobado | 4,49 s |
| Conservar exclusiones al agregar, incluida escasez | Aprobado | 4,04 s |
| Más tranquilo/energético sin inventar metadatos | Aprobado: rechazo explícito y sesión conservada | 9,17 s para ambas peticiones |
| Audio CU08 y playlist CU09 con reintentos/persistencia | Aprobado | 6,15 s |

La inferencia caliente medida tardó **3,8–4,3 segundos**. Los tiempos HTTP incluyen catálogo/Audius y PostgreSQL; la generación inicial completa tardó 16,13 s. Son muestras locales, no latencias garantizadas.

La intensidad se reconoce, pero el catálogo no acredita calma/energía. Se verifica el rechazo seguro de esos ajustes, no una clasificación acústica inexistente.

## Recursos

- Único modelo ejecutado: `LiquidAI/lfm2.5-1.2b-instruct:q4_k_m`, ya instalado. **Ninguna descarga nueva.** Ollama 0.40.16.
- Familia lfm2, 1.170.340.608 parámetros, Q4_K_M, ID 120c341e6281.
- Contexto **2048**, CPU, cuatro hilos, batch 128, máximo 500 tokens de salida, una inferencia simultánea por instancia del adaptador.
- Una llamada al modelo por petición, sin otros modelos ni reintentos que multipliquen la carga.
- Retención de dos minutos de inactividad. Al terminar las pruebas y preparar el entorno se liberó Liquid AI con `ollama stop`; **la API Ollama quedó activa** para cargarlo bajo demanda.
- `ollama ps` confirmó solo Liquid AI: 772 MB, CPU y contexto 2048. No se ejecutaron ni eliminaron gpt-oss/llama3.
- Seis muestras: máximo observado del runner **774,7 MiB de working set**, aproximadamente 0,8 GiB. Muestras puntuales, no pico garantizado. Ver `dj-correction-ram.json`.

## Persistencia y datos

La suite comprueba IDs existentes/reproducibles, modificación real de la cola, exclusiones persistentes, bytes de audio CU08, orden/fuentes de CU09, propiedad, guardados concurrentes con una sola playlist y recuperación con token nuevo.

El catálogo local es pequeño; no se añadieron canciones para forzar resultados. No se reinicializó PostgreSQL, no hubo migraciones nuevas ni seed. Las suites limpian únicamente sus fixtures recién creados; no se borraron cuentas ni datos existentes del usuario. No se ejecutaron compras ni reembolsos.

## Reproducir

Desde backend, con Ollama disponible y sin modelos grandes cargados:

```powershell
$env:OLLAMA_MODEL='LiquidAI/lfm2.5-1.2b-instruct:q4_k_m'
$env:OLLAMA_CONTEXT='2048'
$env:DJ_OLLAMA_TEST='1'
$env:DJ_LIQUID_INTEGRATION='1'
./node_modules/.bin/vitest run src/dj/ollama-real.spec.ts src/dj/dj-liquid-real.spec.ts --no-file-parallelism --reporter=json --outputFile=../docs/dj-liquid-correction-results.json
```

Las suites reales se omiten por defecto sin esas variables. La regresión falsa está separada y no acredita precisión del modelo. No detener los servidores durante las pruebas manuales. Para liberar solamente RAM después de las inferencias: `ollama stop LiquidAI/lfm2.5-1.2b-instruct:q4_k_m`.

## Evidencias

- [12 resultados reales](dj-liquid-correction-results.json).
- [Modelo crudo frente al sistema validado](dj-model-vs-system.json).
- [Salidas originales y tiempos](dj-ollama-inference-observations.json).
- [Flujo HTTP integral](dj-liquid-integration-observations.json).
- [Muestras de RAM](dj-correction-ram.json).
- [Comprobaciones de servicios](servicios-smoke-results.json).
- [Bundle Android y LAN](expo-android-smoke.json).
- [Informe anterior del día 14](CU13-CU14-PRUEBAS-REALES-2026-11-14.md), conservado como historial; no es el resultado actual.

## Distinción de alcance

**Implementado:** interpretación híbrida con evidencia, separación de campos, persistencia, selector CU12 compartido y lanzador persistente.

**Probado automáticamente:** 12 casos reales, 50 regresiones, builds backend/frontend, lint específico DJ, typecheck móvil y bundle Android servido por LAN.

**Probado visualmente:** pantallas de acceso y DJ en navegador, después de apartar artefactos compilados antiguos que ocultaban TypeScript. No se introdujeron credenciales por UI.

**Pendiente:** teléfono físico, audio audible, cámara/QR, compra sandbox completa por UI y mayor cobertura de lenguaje natural. La salida cruda del modelo sigue necesitando validación; no se declara precisión universal ni validación manual integral de todos los casos de uso.

