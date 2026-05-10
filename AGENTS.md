# Repository Guidelines

## How to Use This Guide

- Este repo es un monorepo chico con dos proyectos: `hato-fe/` (Angular) y `hato-be/` (Quarkus).
- Este archivo define reglas globales.
- Cada proyecto tiene su `AGENTS.md` específico y **tiene prioridad** cuando haya conflicto.

## Available Skills

| Skill | Description | URL |
|-------|-------------|-----|
| `angular-hato` | Best practices para Angular 21+ (standalone, signals, testing, arquitectura por feature) | [SKILL.md](skills/angular-hato/SKILL.md) |
| `hato-admin-ux` | Patrones visuales/listas para pantallas operativas admin + ganadero de Hato FE inspirados en pd-fe | [SKILL.md](skills/hato-admin-ux/SKILL.md) |
| `quarkus-hato` | Best practices para Quarkus 3.x (capas, Panache, validación, testing REST) | [SKILL.md](skills/quarkus-hato/SKILL.md) |

## Auto-invoke Skills

Cuando hagas estas tareas, cargá primero el skill correspondiente:

| Action | Skill |
|--------|-------|
| Crear/modificar componentes, rutas, servicios Angular | `angular-hato` |
| Crear/modificar pantallas operativas visuales/listas admin o ganadero en Hato FE | `angular-hato`, `hato-admin-ux` |
| Crear/modificar recursos REST, services, repositorios Quarkus | `quarkus-hato` |
| Trabajar en `hato-fe/` | `angular-hato` |
| Trabajar en `hato-be/` | `quarkus-hato` |

## Project Conventions

- Frontend: ver `hato-fe/AGENTS.md`
- Backend: ver `hato-be/AGENTS.md`
- Skills locales del proyecto: `skills/`
