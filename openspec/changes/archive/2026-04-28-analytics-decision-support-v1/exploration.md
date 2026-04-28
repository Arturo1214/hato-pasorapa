## Exploration: analytics-decision-support-v1

### Current State
El sistema ya resuelve reporting descriptivo offline-first con snapshots locales y recalculo por frescura (`admin/reportes`), incluyendo ventanas acotadas (`7d`,`30d`,`90d`), presets cerrados y exclusiones explícitas de BI avanzada/predictiva.  
En backend no existe un endpoint dedicado de analítica de decisión del hato: el flujo principal para datos operativos es sync (`/api/sync`) y el dashboard admin remoto actual está limitado a métricas de usuarios.  
La base funcional disponible para decisiones descriptivas locales ya incluye: animales, eventos operativos/sanitarios/reproductivos, lotes/asignaciones, productividad, costos, calendario y reporting V1/V2.

### Affected Areas
- `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting-projection.ts` — núcleo de proyección descriptiva local; punto natural para sumar indicadores/insights no predictivos.
- `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.store.ts` — orquesta recálculo, frescura, presets y persistencia derivada offline.
- `hato-fe/src/app/features/admin/reporting/data-access/admin-reporting.utils.ts` — guardrails de alcance (sin filtros libres ni analítica predictiva).
- `hato-fe/src/app/features/admin/reporting/admin-reporting-page.component.ts` — UX actual de lectura; base para incorporar soporte de decisión guiado (warnings, comparativas, checklist).
- `hato-fe/src/app/core/offline/offline-types.ts` — contratos de estado derivado/selecciones para extender tipado de insights locales.
- `hato-fe/src/app/core/offline/offline-store.service.ts` — persistencia e invalidación del estado derivado de reporting/analytics.
- `hato-be/src/main/java/bo/pasorapa/hato/service/SyncService.java` — fuente de sincronización de entidades del dominio usadas por analítica local.
- `hato-be/src/main/java/bo/pasorapa/hato/service/mapper/SyncPayloadMapper.java` — reglas de contrato/canonicalización (periodKey mensual, dedupe identitario) que condicionan consistencia de indicadores.
- `openspec/specs/admin-reporting-aggregates-v1/spec.md` — límites de ventanas/presets y rechazo de filtros ad-hoc.
- `openspec/specs/admin-reporting-operational-events-v1/spec.md` — exclusiones explícitas de predictiva/optimización en reporting operativo.
- `openspec/specs/herd-descriptive-indicators-projection-v2/spec.md` — contrato vigente de KPIs descriptivos locales sin outputs predictivos.

### Approaches
1. **Extender `admin/reportes` con “Decision Cards” locales (sin nuevo módulo)** — agregar capa de interpretación descriptiva sobre KPIs existentes (tendencias, variación período contra período, semáforos y acciones sugeridas manuales).
   - Pros: menor fricción UX, reutiliza store/proyección actuales, menor costo de entrega inicial.
   - Cons: puede sobrecargar la pantalla actual y mezclar “reporte” con “soporte de decisión”; escalabilidad funcional limitada.
   - Effort: Medium.

2. **Nuevo feature FE `admin/decision-support` consumiendo proyecciones locales compartidas (recomendado)** — separar visualmente decisión vs reporte, con pipeline local-first que combina eventos, sanidad, reproducción, lotes, productividad y costos en vistas guiadas por preguntas de gestión.
   - Pros: separación clara de responsabilidades, mejor mantenibilidad por feature, permite UX específica (priorización, alertas, comparativas) sin tocar endpoint remoto.
   - Cons: mayor superficie FE (nueva ruta/store/componentes/tests), requiere definir contrato de insights derivado estable.
   - Effort: Medium/High.

3. **Servicio BE de “analytics” con agregados precomputados** — crear endpoint backend para consolidar indicadores de decisión y bajar complejidad en FE.
   - Pros: centraliza reglas de negocio analítica y homogeneiza resultados entre clientes.
   - Cons: tensiona offline-first (dependencia de red para valor completo), aumenta costo sync/cache y riesgo de drift online-vs-offline.
   - Effort: High.

### Recommendation
Adoptar **Approach 2** con entrega incremental: mantener cálculo local como fuente de verdad y crear un feature dedicado de soporte de decisión descriptivo.  
Este enfoque preserva offline-first, evita acoplarse a backend analítico y permite UX más útil para decisiones operativas (prioridades del día/semana, desvíos de costo/productividad, seguimiento de eventos críticos) sin caer en predicción ni optimización automática.

### Risks
- **Scope creep a BI predictiva**: incorporar scoring/forecast/recomendaciones automáticas rompería límites explícitos del producto.
- **Ambigüedad semántica de “decisión”**: sin taxonomía clara de insights, se puede terminar en dashboards decorativos sin accionabilidad real.
- **Deriva de performance local**: más cálculos en FE pueden degradar dispositivos de campo si no hay estrategia de recomputación incremental/cache.
- **Inconsistencia temporal**: mezclar fechas de eventos (`occurredAt`) con `periodKey` mensual en costos/productividad sin normalización puede sesgar comparativas.
- **Cobertura de pruebas insuficiente**: cambios en proyecciones derivadas exigen ampliar tests de comportamiento (store/projection/component) para evitar regresiones offline.

### Ready for Proposal
Yes — listo para `sdd-propose` con alcance mínimo recomendado: (1) UX de soporte de decisión descriptivo local, (2) contrato explícito de insights/guardrails anti-predictiva, (3) criterios de éxito medibles (tiempo para detectar desvíos, consistencia offline, cero dependencias externas).
