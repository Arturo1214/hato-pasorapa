# Hato BE - AI Agent Ruleset

> Skills locales recomendados:
> - [`quarkus-hato`](../skills/quarkus-hato/SKILL.md)

## Auto-invoke Skills

| Action | Skill |
|--------|-------|
| Crear/modificar recursos REST JAX-RS | `quarkus-hato` |
| Crear/modificar servicios y mappers | `quarkus-hato` |
| Crear/modificar repositorios Panache | `quarkus-hato` |
| Crear validaciones y DTOs de entrada/salida | `quarkus-hato` |

---

## Stack

Quarkus 3.34.x · Java 21 · Maven Wrapper · Panache ORM · Hibernate Validator · Liquibase · PostgreSQL · SmallRye JWT

## Structure

- API/REST: `hato-be/src/main/java/**/web/rest`
- Servicios y DTOs: `hato-be/src/main/java/**/service`
- Repositorios y entidades: `hato-be/src/main/java/**/repository`, `**/domain`

## Commands

```bash
./mvnw quarkus:dev
./mvnw test
./mvnw -DskipTests compile
```

## Testing

- Runner principal: JUnit 5 (`quarkus-junit5`) con Maven Surefire
- Integración REST: `rest-assured` (dependencia presente)
- Tests nativos/integración: Maven Failsafe profile `native`

## Reglas Base

- Mantener separación clara por capas (REST → Service → Repository/Domain).
- DTOs para fronteras externas; no exponer entidades directamente en recursos REST.
- Validar entrada en DTOs con Jakarta Validation antes de ejecutar lógica de negocio.
- Preferir consultas tipadas/reutilizables; evitar lógica ad-hoc dispersa en recursos.
