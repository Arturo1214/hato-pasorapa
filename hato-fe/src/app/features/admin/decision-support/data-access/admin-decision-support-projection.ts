import type {
  DecisionSupportDerivedState,
  DecisionSupportInsight,
  OfflineSnapshotRecord,
  ReportingWindow,
} from '../../../../core/offline/offline-types';
import { ADMIN_DECISION_SUPPORT_MANUAL_ACTIONS } from '../../shared/admin-analytics-scope';
import { buildAdminReportingProjectionBase, type AdminReportingProjectionInput } from '../../reporting/data-access/admin-reporting-projection';
import {
  calculateDeltaPct,
  coerceDecisionSupportWindow,
  filterWindowRecords,
  isPeriodKeyInWindow,
  resolveDecisionSupportSeverity,
} from './admin-decision-support.utils';

export interface AdminDecisionSupportProjectionInput extends Omit<AdminReportingProjectionInput, 'selectedPreset'> {
  selectedWindow: ReportingWindow | string;
}

export interface AdminDecisionSupportProjectionResult {
  selectedWindow: ReportingWindow;
  insights: DecisionSupportInsight[];
}

export interface DecisionSupportPeriodComparison<T> {
  currentRecords: T[];
  baselineRecords: T[];
  currentValue: number;
  baselineValue: number;
}

export function projectDecisionSupportV1(input: AdminDecisionSupportProjectionInput): AdminDecisionSupportProjectionResult {
  const selectedWindow = coerceDecisionSupportWindow(input.selectedWindow);
  const base = buildAdminReportingProjectionBase({ ...input, selectedWindow, selectedPreset: 'all' });

  const costComparison = buildDecisionSupportPeriodComparison(base.visibleCostLedger, {
    window: selectedWindow,
    now: input.now,
    periodKeyOf: (snapshot) => snapshot.payload.periodKey,
    measureOf: (snapshot) => Number(snapshot.payload.amount),
  });
  const costDeltaPct = calculateDeltaPct(costComparison.currentValue, costComparison.baselineValue);

  const currentHealthEvents = filterWindowRecords(base.activities.filter((activity) => activity.sourceType === 'ANIMAL_HEALTH_EVENT'), (activity) => activity.occurredAt, selectedWindow, input.now).length;
  const productivityComparison = buildDecisionSupportPeriodComparison(base.visibleProductivityLedger, {
    window: selectedWindow,
    now: input.now,
    periodKeyOf: (snapshot) => snapshot.payload.periodKey,
  });
  const productivityDeltaPct = calculateDeltaPct(productivityComparison.currentValue, productivityComparison.baselineValue);

  return {
    selectedWindow,
    insights: [
      buildInsight({
        id: `cost-${selectedWindow}`,
        category: 'cost',
        window: selectedWindow,
        metric: 'Costo por encima de la línea base',
        currentValue: costComparison.currentValue,
        baselineValue: costComparison.baselineValue,
        deltaPct: costDeltaPct,
        severity: resolveDecisionSupportSeverity(costDeltaPct),
        source: ['COST_LEDGER', 'PRODUCTIVITY_LEDGER'],
        rule: 'Comparación descriptiva periodo contra periodo sobre costos y actividad productiva.',
        generatedAt: input.now,
        manualActions: [...ADMIN_DECISION_SUPPORT_MANUAL_ACTIONS.cost],
      }),
      buildInsight({
        id: `health-${selectedWindow}`,
        category: 'health',
        window: selectedWindow,
        metric: 'Eventos sanitarios recientes a revisar',
        currentValue: currentHealthEvents,
        baselineValue: 0,
        deltaPct: currentHealthEvents > 0 ? 100 : 0,
        severity: resolveDecisionSupportSeverity(currentHealthEvents > 0 ? 12 : 0),
        source: ['ANIMAL_HEALTH_EVENT'],
        rule: 'Conteo descriptivo de eventos sanitarios dentro de la ventana seleccionada.',
        generatedAt: input.now,
        manualActions: [...ADMIN_DECISION_SUPPORT_MANUAL_ACTIONS.health],
      }),
      buildInsight({
        id: `productivity-${selectedWindow}`,
        category: 'productivity',
        window: selectedWindow,
        metric: 'Productividad a confirmar contra la línea base',
        currentValue: productivityComparison.currentValue,
        baselineValue: productivityComparison.baselineValue,
        deltaPct: productivityDeltaPct,
        severity: resolveDecisionSupportSeverity(productivityDeltaPct),
        source: ['PRODUCTIVITY_LEDGER'],
        rule: 'Comparación descriptiva periodo contra periodo sobre entradas de productividad.',
        generatedAt: input.now,
        manualActions: [...ADMIN_DECISION_SUPPORT_MANUAL_ACTIONS.productivity],
      }),
    ],
  };
}

export function buildDecisionSupportPeriodComparison<T extends { entityId: string }>(
  records: T[],
  options: {
    window: ReportingWindow;
    now: string;
    periodKeyOf: (record: T) => string;
    measureOf?: (record: T) => number;
  }
): DecisionSupportPeriodComparison<T> {
  const currentRecords = records
    .filter((record) => isPeriodKeyInWindow(options.periodKeyOf(record), options.window, options.now))
    .sort((left, right) => compareDecisionSupportComparisonRecord(left, right, options.periodKeyOf));
  const baselineRecords = records
    .filter((record) => isPeriodKeyInWindow(options.periodKeyOf(record), options.window, options.now, true))
    .sort((left, right) => compareDecisionSupportComparisonRecord(left, right, options.periodKeyOf));
  const resolveValue = options.measureOf ?? (() => 1);

  return {
    currentRecords,
    baselineRecords,
    currentValue: sumValues(currentRecords, resolveValue),
    baselineValue: sumValues(baselineRecords, resolveValue),
  };
}

export function createInitialDecisionSupportState(): DecisionSupportDerivedState {
  return {
    version: 1,
    selectedWindow: '7d',
    freshness: {
      lastSyncAt: null,
      lastComputedAt: null,
      stale: true,
    },
    insights: [],
    sourceSignature: {
      USER: null,
      GANADERO: null,
      ANIMAL: null,
      LOT: null,
      LOT_ASSIGNMENT: null,
      PRODUCTIVITY_LEDGER: null,
      COST_LEDGER: null,
      ANIMAL_EVENT: null,
      ANIMAL_HEALTH_EVENT: null,
      ANIMAL_REPRODUCTION_EVENT: null,
      selection: '7d',
    },
  };
}

function buildInsight(insight: Omit<DecisionSupportInsight, 'scopeGuard' | 'why'> & { source: string[]; rule: string; generatedAt: string }): DecisionSupportInsight {
  return {
    ...insight,
    scopeGuard: 'descriptive_only',
    why: {
      source: insight.source,
      rule: insight.rule,
      generatedAt: insight.generatedAt,
    },
  };
}

function compareDecisionSupportComparisonRecord<T extends { entityId: string }>(left: T, right: T, periodKeyOf: (record: T) => string) {
  const periodComparison = periodKeyOf(left).localeCompare(periodKeyOf(right));
  if (periodComparison !== 0) {
    return periodComparison;
  }
  return left.entityId.localeCompare(right.entityId);
}

function sumValues<T>(records: T[], resolveValue: (record: T) => number) {
  return Number(records.reduce((sum, record) => sum + Number(resolveValue(record)), 0).toFixed(2));
}
