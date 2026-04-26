---
name: angular-hato
description: >
  Convenciones Angular para Pasorapa Hato: standalone, arquitectura por feature, signals, formularios y testing.
  Trigger: Cuando se cree/modifique código en hato-fe (componentes, rutas, servicios, formularios o tests).
license: MIT
metadata:
  author: pasorapa-hato
  version: "1.0"
---

## Reglas accionables

- Usar **componentes standalone**; evitar volver a patrones centrados en NgModule.
- Aplicar **arquitectura por feature** (`src/app/<feature>/...`) y evitar carpetas técnicas globales sin necesidad.
- Para estado local/simple: preferir **signals** (`signal`, `computed`, `effect`).
- Para asincronía y composición de streams: usar RxJS de forma explícita y tipada.
- Formularios: usar `ReactiveFormsModule`, validaciones declarativas y mensajes de error consistentes.
- Evitar lógica de negocio compleja en templates o componentes de presentación.
- Tests unitarios: crear/actualizar `*.spec.ts` en la misma feature y cubrir casos happy-path + validación/error.
- Para estilos: SCSS por componente y convenciones de diseño consistentes con Angular Material/CDK.

## Checklist rápido

1. ¿El código respeta separación contenedor/presentación?
2. ¿La feature tiene rutas, estado y servicios cohesivos?
3. ¿Hay test unitario actualizado si cambia comportamiento?
4. ¿Se evita duplicar utilidades compartibles entre features?
