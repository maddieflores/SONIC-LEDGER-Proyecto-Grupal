# Arquitectura inicial

Web React y app React Native/Expo -> API REST NestJS -> PostgreSQL.
NestJS -> servicio Python FastAPI -> recomendador scikit-learn / Ollama local.
La aplicacion movil nunca debe conectarse directamente a PostgreSQL ni a Ollama.

## Decisiones

- TypeScript en web, backend y mobile, respetando las tecnologias del PDF.
- Backend modular, sin microservicios de negocio para evitar complejidad prematura.
- PostgreSQL 16: persistencia relacional y transacciones de compra.
- TypeORM: integracion oficial con NestJS; migraciones explicitas, sin sincronizacion automatica.
- Python aislado con venv para IA; el servicio no requiere API de nube.
- Docker mantiene PostgreSQL y Ollama separados de las instalaciones globales existentes.
- Node 24 local al proyecto por compatibilidad con los generadores actuales.
- Dependencias de JWT, permisos, WebSockets y funciones moviles instaladas para implementacion posterior; instalarlas no significa tener esas funciones terminadas.

## Limites actuales

Solo estan implementados el chequeo de infraestructura, pantallas iniciales y endpoints base de IA.
No hay autenticacion, tablas de negocio, pagos, streaming ni tickets implementados.
No se afirma cumplimiento completo de los siete factores de calidad hasta implementar y medir los flujos reales.
Los endpoints IA son internos al host, no una API publica autenticada.
