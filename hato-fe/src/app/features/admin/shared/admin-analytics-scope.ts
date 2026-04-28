export const ADMIN_ANALYTICS_WINDOWS = ['7d', '30d', '90d'] as const;
export const ADMIN_ANALYTICS_BLOCKED_TERMS = ['forecast', 'score', 'optimization', 'autoAction', 'autoApply'] as const;

export const ADMIN_REPORTING_SCOPE_MESSAGE =
  'V2 descriptivo: sin filtros libres, exportaciones complejas, reportes programados ni analítica predictiva.';

export const ADMIN_DECISION_SUPPORT_SCOPE_MESSAGE =
  'Soporte descriptivo solamente: sin forecast, score, optimización ni ejecución automática.';

export const ADMIN_DECISION_SUPPORT_AUTO_APPLY_MESSAGE = 'Auto-apply bloqueado · Decisión manual requerida.';

export const ADMIN_DECISION_SUPPORT_MANUAL_ACTIONS = {
  cost: ['Revisar manualmente costos del lote y confirmar decisión manual.'],
  health: ['Coordinar seguimiento manual del evento sanitario priorizado.'],
  productivity: ['Verificar manualmente productividad del lote antes de actuar.'],
} as const;
