import type { DecisionSupportSeverity, ReportingWindow } from '../../../../core/offline/offline-types';
import {
  ADMIN_ANALYTICS_BLOCKED_TERMS,
  ADMIN_ANALYTICS_WINDOWS,
  ADMIN_DECISION_SUPPORT_AUTO_APPLY_MESSAGE,
  ADMIN_DECISION_SUPPORT_SCOPE_MESSAGE,
} from '../../shared/admin-analytics-scope';
import { parseReportingDate } from '../../reporting/data-access/admin-reporting.utils';

export const ALLOWED_DECISION_SUPPORT_WINDOWS: readonly ReportingWindow[] = ADMIN_ANALYTICS_WINDOWS;
export const DECISION_SUPPORT_SCOPE_MESSAGE = ADMIN_DECISION_SUPPORT_SCOPE_MESSAGE;
export const DECISION_SUPPORT_AUTO_APPLY_MESSAGE = ADMIN_DECISION_SUPPORT_AUTO_APPLY_MESSAGE;

export function coerceDecisionSupportWindow(value: string | null | undefined): ReportingWindow {
  return ALLOWED_DECISION_SUPPORT_WINDOWS.includes(value as ReportingWindow) ? (value as ReportingWindow) : '7d';
}

export function assertDecisionSupportScope(requestedFields: string[]) {
  const blocked = requestedFields.find((field) => ADMIN_ANALYTICS_BLOCKED_TERMS.includes(field as (typeof ADMIN_ANALYTICS_BLOCKED_TERMS)[number]));
  if (blocked) {
    throw new Error(`Campo fuera de alcance para decision support v1: ${blocked}`);
  }
}

export function filterWindowRecords<T>(records: T[], resolveDate: (record: T) => string, window: ReportingWindow, nowIso: string) {
  const now = parseReportingDate(nowIso) ?? new Date();
  const start = createWindowStart(window, now);
  return records.filter((record) => {
    const date = parseReportingDate(resolveDate(record));
    return date != null && date.getTime() >= start.getTime() && date.getTime() <= now.getTime();
  });
}

export function resolveDecisionSupportSeverity(deltaPct: number): DecisionSupportSeverity {
  const absoluteDelta = Math.abs(deltaPct);
  if (absoluteDelta >= 30) {
    return 'critical';
  }
  if (absoluteDelta >= 10) {
    return 'watch';
  }
  return 'info';
}

export function calculateDeltaPct(currentValue: number, baselineValue: number) {
  if (baselineValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }
  return Number((((currentValue - baselineValue) / baselineValue) * 100).toFixed(2));
}

export function createWindowStart(window: ReportingWindow, now: Date) {
  const days = window === '7d' ? 7 : window === '30d' ? 30 : 90;
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export function createPreviousWindowStart(window: ReportingWindow, now: Date) {
  const currentStart = createWindowStart(window, now);
  return new Date(currentStart.getTime() - (now.getTime() - currentStart.getTime()));
}

export function isPeriodKeyInWindow(periodKey: string, window: ReportingWindow, nowIso: string, previous = false) {
  const now = parseReportingDate(nowIso) ?? new Date();
  const end = previous ? createWindowStart(window, now) : now;
  const start = previous ? createPreviousWindowStart(window, now) : createWindowStart(window, now);
  const periodDate = parseReportingDate(`${periodKey}-01T00:00:00.000Z`);

  return periodDate != null && periodDate.getTime() >= start.getTime() && periodDate.getTime() <= end.getTime();
}
