# Hato FE - AI Agent Ruleset

> Skills locales recomendados:
> - [`angular-hato`](../skills/angular-hato/SKILL.md)
> - [`hato-admin-ux`](../skills/hato-admin-ux/SKILL.md)

## Auto-invoke Skills

| Action | Skill |
|--------|-------|
| Crear componentes, directivas o pipes en Angular | `angular-hato` |
| Crear o modificar rutas y guards | `angular-hato` |
| Crear o modificar pantallas operativas visuales/listas admin o ganadero | `angular-hato`, `hato-admin-ux` |
| Implementar formularios reactivos y validaciones | `angular-hato` |
| Escribir tests unitarios de Angular | `angular-hato` |

---

## Stack

Angular 21.2.x · TypeScript 5.9.x · Angular Material/CDK · RxJS 7.8.x · SCSS · Vitest (via `ng test`)

## Structure

- Código fuente: `hato-fe/src/app/`
- Assets públicos: `hato-fe/public/`
- Config Angular: `hato-fe/angular.json`

## Commands

```bash
npm start
npm run build
npm test
```

## Testing

- Runner principal: `ng test` (`@angular/build:unit-test`, Vitest)
- Tests unitarios en `*.spec.ts`
- E2E no configurado por defecto

## Reglas Base

- Preferir componentes standalone y APIs modernas de Angular.
- Usar Signals para estado local/simple; RxJS para flujos async y orquestación.
- Mantener arquitectura por feature dentro de `src/app/`.
- No mezclar lógica de UI, dominio y acceso a datos en el mismo componente.
