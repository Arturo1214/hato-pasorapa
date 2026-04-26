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
```

## PostgreSQL con Docker

El proyecto incluye `docker-compose.yml` con PostgreSQL expuesto en `localhost:5434`
para no chocar con tu instancia local en `5432`.

```bash
docker compose up -d
docker compose down
```

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
