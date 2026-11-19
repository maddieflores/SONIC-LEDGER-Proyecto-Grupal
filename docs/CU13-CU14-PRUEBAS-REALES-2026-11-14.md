# Pruebas reales CU13 / CU14 con Liquid AI

Fecha local: 14 de noviembre de 2026, America/La_Paz.

## Conclusión

**CU13 y CU14 NO están aprobados integralmente.** La descarga, identificación y ejecución local funcionan, pero el modelo autorizado produce interpretaciones semánticas incorrectas con el contrato actual. No se reemplazó la inferencia por reglas ni se usó otro modelo.

Ronda final estricta: **1 aprobada, 6 fallidas, 5 pendientes por dependencia**. Los cinco casos pendientes necesitan una sesión generada correctamente; se omiten explícitamente para no convertir errores derivados en nuevos fallos del producto.

## Modelo y recursos

- Descarga exclusiva: `ollama pull LiquidAI/lfm2.5-1.2b-instruct:q4_k_m`.
- Ollama Windows: 0.40.16. Modelo instalado: ID `120c341e6281`, aproximadamente 730 MB en disco.
- Metadatos reales: familia `lfm2`, `1.2B`, 1.170.340.608 parámetros, cuantización `Q4_K_M`, tag `lfm2.5`.
- Antes de descargar/ejecutar: `ollama ps` vacío. No se ejecutaron ni eliminaron `gpt-oss:20b` o `llama3:latest`.
- Ejecución: contexto **2048**, **CPU**, cuatro hilos, batch 128 y una solicitud de inferencia en curso como máximo. No se incrementó el contexto ni se instalaron dependencias.
- `ollama ps`: tamaño cargado 772 MB, procesador 100% CPU. Esto describe dónde se ejecutó, no una medición de utilización instantánea de CPU.
- Runner `llama-server`: aproximadamente **776–789 MiB de working set**, hasta 807 MiB privados en las muestras. Procesos Ollama/UI: unos 87 MiB adicionales de working set. Muestras puntuales, no perfilado continuo ni pico garantizado.
- RAM total visible: 15.680 MiB. Disponible durante muestras: 886–1.323 MiB; tras una descarga de RAM: 2.279 MiB. Estas cifras incluyen la actividad de otros programas; no se cerraron procesos del usuario.
- Al finalizar: `ollama stop LiquidAI/lfm2.5-1.2b-instruct:q4_k_m`; `ollama ps` quedó vacío. El modelo sigue instalado y los dos modelos anteriores se conservaron.

## Resultados finales

| Caso | Resultado | Tiempo de prueba |
| --- | --- | --- |
| Disponibilidad e identidad del modelo local | Aprobada | 0,15 s |
| “Rock para entrenar” | Fallida: añade atributos no pedidos, incluida energía | 11,35 s |
| “Pop sin electrónica” | Fallida: no registra correctamente la exclusión | 4,66 s |
| “Quiero algo relajante” | Fallida: reconoce calma, pero inventa filtros de género/preferencia | 4,55 s |
| “Canciones parecidas a mis favoritas” | Fallida: reconoce favoritas, pero añade filtros no solicitados | 4,74 s |
| “Agrega cinco canciones” con restricciones anteriores | Fallida: devuelve exclusiones vacías y otros campos no pedidos | 4,64 s |
| HTTP CU13 “Quiero una canción” con catálogo y PostgreSQL reales | Fallida: inventa calma; el selector devuelve 400 por falta de metadatos confiables | 18,02 s |
| Agregar mediante CU14 sobre sesión generada | Pendiente: generación fallida | — |
| Exclusión sobre la cola generada | Pendiente: generación fallida | — |
| Persistencia de exclusiones a través de ajustes reales | Pendiente: generación fallida | — |
| Rechazo de ajustes de energía sin metadatos sobre sesión generada | Pendiente: generación fallida | — |
| Audio CU08 y playlist CU09 desde esa sesión generada | Pendiente: generación fallida | — |

Los tiempos incluyen la operación de prueba correspondiente. Los aproximadamente 4,5 s de los casos calientes son principalmente inferencia; 11,35 s incluye recarga del runner. Los 18,02 s del caso HTTP incluyen inferencia y servicios de catálogo/recomendación. No son benchmarks de calidad ni latencias garantizadas.

Las comprobaciones se reforzaron después de la primera ronda: encontrar un género o `favorites=true` no basta si aparecen otros filtros inventados. Por eso los resultados finales son más estrictos que los primeros chequeos parciales.

## Catálogo, CU08 y CU09

La base local tenía solo **dos canciones publicadas**, con géneros Electrónica y Synthwave. No se añadieron canciones ni se modificó su contenido para hacer pasar las pruebas. La suite integral usa el intérprete, CU12, catálogo, autenticación y PostgreSQL reales, sin sustituir proveedores.

La generación integral falló antes de producir una cola, así que no se puede acreditar selección/reproducción/guardado integral desde Liquid AI. La generación rechazada no guardó una sesión ni una playlist incorrecta. Los usuarios temporales de prueba se eliminaron con sus datos asociados.

La suite separada `dj-postgres.spec.ts` se repitió: **4 pruebas aprobadas** con PostgreSQL y HTTP reales pero **sin inferencia**. Verifica autenticación, audio LOCAL con rango de bytes, acceso ajeno rechazado, reintentos concurrentes con una sola playlist y recuperación con nuevas credenciales. Es evidencia de integración técnica, no de un DJ funcional con Liquid AI. Sus resultados se registran aparte en `dj-cu08-cu09-regression-results.json`.

## Correcciones conservadas

Solo integración del DJ, configuración y pruebas/documentación:

- `backend/.env`: URL local, etiqueta exacta autorizada, contexto 2048 y timeout 45 segundos; no se expusieron secretos en los informes.
- `ollama.adapter.ts`: CPU explícita y batch acotado. Compatibilidad con la distribución oficial, que no incluye `general.name`: verifica etiqueta exacta, tags, número de parámetros, tamaño, familia y cuantización; sigue rechazando proveedores remotos/otros modelos.
- Prueba automática de esa variante real de metadatos.
- Registro de salidas originales, tiempos y consumo aproximado de RAM.
- Nueva suite integral real sin mocks y omisión explícita de pruebas dependientes si falla generar la sesión.

Se probaron prompts más cortos, ejemplos, separación del contexto, modo JSON y extracciones pequeñas secuenciales. No resolvieron de forma fiable los errores; esas variantes se descartaron. Se conserva el esquema JSON estricto y el prompt original, evitando presentar cambios experimentales como una solución validada. No se modificaron CU08, CU09, pagos ni módulos ajenos en esta ronda.

Regresión simulada del DJ: **34 pruebas aprobadas**; acredita reglas de aplicación y contrato con un adaptador falso, no corrige la calidad semántica real. Build y lint específico del DJ se comprueban por separado.

## Reproducción

Desde `backend`, con Ollama ya disponible y sin modelos grandes cargados:

```powershell
$env:OLLAMA_MODEL='LiquidAI/lfm2.5-1.2b-instruct:q4_k_m'
$env:OLLAMA_CONTEXT='2048'
$env:DJ_OLLAMA_TEST='1'
$env:DJ_LIQUID_INTEGRATION='1'
try {
  ./node_modules/.bin/vitest run src/dj/ollama-real.spec.ts src/dj/dj-liquid-real.spec.ts --no-file-parallelism --reporter=json --outputFile=../docs/dj-liquid-final-results.json
} finally {
  ollama stop LiquidAI/lfm2.5-1.2b-instruct:q4_k_m
  ollama ps
}
```

La suite requiere el esquema ya migrado y una base local con pistas publicadas. Crea una cuenta temporal y elimina únicamente sus fixtures al terminar. Para consultar el estado final de Vitest se debe leer el informe JSON o conservar su código de salida antes del bloque de limpieza.

## Evidencias

- [Resultado final de las 12 comprobaciones](dj-liquid-final-results.json).
- [Salidas y tiempos de inferencia sin transformar](dj-ollama-inference-observations.json).
- [Petición/respuesta HTTP integral](dj-liquid-integration-observations.json).
- [Muestra de RAM con el runner cargado](dj-ram-sample.json).
- [Muestra tras descargarlo de memoria](dj-ram-after-stop.json).
- [ollama ps vacío después de stop](dj-ollama-ps-after-stop.txt).

Quedan pendientes la corrección fiable de la interpretación con este mismo modelo y la repetición satisfactoria del flujo integral. También permanecen pendientes la comprobación visual y escucha audible en Android. No se afirma que CU13/CU14 estén completados.

