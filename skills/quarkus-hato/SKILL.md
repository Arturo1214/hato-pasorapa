---
name: quarkus-hato
description: >
  Convenciones Quarkus para Pasorapa Hato: capas REST/Service/Repository, DTOs, validación y testing.
  Trigger: Cuando se cree/modifique código en hato-be (recursos REST, servicios, repositorios, mappers, DTOs o tests).
license: MIT
metadata:
  author: pasorapa-hato
  version: "1.0"
---

## Reglas accionables

- Respetar flujo por capas: **Resource (REST) → Service → Repository/Domain**.
- Recursos REST sin lógica pesada: parsean request, delegan y devuelven respuesta HTTP.
- Contratos externos vía DTOs; no exponer entidades JPA directamente.
- Validaciones en DTOs con Jakarta Bean Validation (`@NotNull`, `@Size`, etc.).
- Repositorios Panache para persistencia y consultas reusables; evitar duplicación de filtros.
- Mapear entidades↔DTO con mappers explícitos y testeables.
- Errores de negocio con respuestas HTTP consistentes y trazables.
- Tests con `quarkus-junit5`; para endpoints usar `rest-assured` y validar status + payload.

## Checklist rápido

1. ¿La lógica de negocio quedó en Service?
2. ¿El endpoint usa DTOs validados y respuesta estable?
3. ¿La consulta quedó encapsulada en repository/service reutilizable?
4. ¿Hay cobertura de tests para caminos principal y de error?
