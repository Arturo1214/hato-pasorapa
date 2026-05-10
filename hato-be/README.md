# hato-be

Proyecto backend monolítico con Quarkus para `bo.pasorapa.hato`.

Base tomada del patrón usado en `notify-hub`, pero consolidando todo en un solo módulo:

- filtros tipados por query string
- paginación y ordenamiento propios
- JPA Criteria para búsquedas dinámicas
- JWT local con SmallRye JWT
- Liquibase para esquema inicial
- OpenAPI, Swagger UI, Health y Prometheus

## Requisitos

- Java 21
- Maven 3.9+
- PostgreSQL 14+

## Ejecutar

```bash
export JAVA_HOME=$(/usr/libexec/java_home -v 21)
docker compose up -d
./mvnw quarkus:dev
```

## Variables principales

```bash
export DB_URL=jdbc:postgresql://localhost:5434/hato
export DB_USER=postgres
export DB_PASS=postgres
export CORS_ORIGINS=http://localhost:3000,http://localhost:5173
export QUARKUS_LOG_FILE_PATH=/work/logs/hato-be.log
export QUARKUS_LOG_CONSOLE_JSON_ENABLED=false
export QUARKUS_LOG_FILE_JSON_ENABLED=false
```

## Logs y trazabilidad HTTP

- Consola y archivo usan **texto plano legible**, no JSON.
- En Quarkus 3.34.x las flags correctas del extension `quarkus-logging-json` son `quarkus.log.console.json.enabled=false` y `quarkus.log.file.json.enabled=false`.
- En Docker/dev podés persistir el archivo con `QUARKUS_LOG_FILE_PATH` (default runtime: `/work/logs/hato-be.log`).
- Cada request `/api/*` genera:
  - `request started`: método, path y resumen sanitizado (`queryKeys`, `contentType`, `contentLength`)
  - `request completed`: método, path, status y duración en ms
  - headers de correlación: `X-Request-Id` y, cuando hay 500, `X-Error-Id`
- No se loguean bodies, passwords, tokens ni valores de query string para evitar fuga de datos sensibles.

Ejemplo:

```text
2026-05-03 15:24:11,482 INFO  requestId=ef4f6c58-0b8b-4fef-a5d3-f0f2f6f29c69 [b.p.h.w.r.o.ApiRequestLoggingFilter] (executor-thread-1) HTTP request started POST /api/auth/login summary={queryKeys=[], contentType=application/json, contentLength=52}
2026-05-03 15:24:11,539 INFO  requestId=ef4f6c58-0b8b-4fef-a5d3-f0f2f6f29c69 [b.p.h.w.r.o.ApiRequestLoggingFilter] (executor-thread-1) HTTP request completed POST /api/auth/login -> 200 (57 ms)
```

Si ocurre un error no controlado, el backend deja stack trace completo en servidor con `requestId` + `errorId`, mientras que al cliente le responde un mensaje genérico seguro.

## PostgreSQL con Docker

El proyecto incluye `docker-compose.yml` con PostgreSQL expuesto en `localhost:5434`
para no chocar con tu instancia local en `5432`.

```bash
docker compose up -d
docker compose down
```

## Credencial inicial de instalación

Liquibase siembra un usuario administrador inicial para arranque/instalación:

- username: `root-admin`
- password: `RootAdmin9`
- email: `root-admin@hato.bo`

Usala solo para el primer acceso y cambiala/rotala inmediatamente en ambientes reales.

## JWT para desarrollo

Se incluyó un endpoint público para emitir tokens de desarrollo:

```http
POST /api/auth/token
Content-Type: application/json

{
  "username": "admin",
  "roles": ["ADMIN", "USER"]
}
```

## Ejemplo de filtros y paginación

```http
GET /api/animals?page=0&size=20&sort=code,asc&active.equals=true&category.equals=COW&tag.contains=HT
```
