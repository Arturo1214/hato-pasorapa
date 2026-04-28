import type {
  AdminReportingEventSourceType,
  AdminReportingRecentActivityItem,
  ReportingPresetId,
  ReportingWindow,
} from '../../../../core/offline/offline-types';
import { ADMIN_ANALYTICS_WINDOWS, ADMIN_REPORTING_SCOPE_MESSAGE } from '../../shared/admin-analytics-scope';

export const RECENT_ACTIVITY_LIMIT = 20;
export const DEFAULT_REPORTING_WINDOW: ReportingWindow = '7d';
export const DEFAULT_REPORTING_PRESET: ReportingPresetId = 'all';
export const ALLOWED_REPORTING_WINDOWS: readonly ReportingWindow[] = ADMIN_ANALYTICS_WINDOWS;
export const ALLOWED_REPORTING_PRESETS: readonly ReportingPresetId[] = ['all', 'active_only', 'inactive_only'];
export const REPORTING_SCOPE_MESSAGE = ADMIN_REPORTING_SCOPE_MESSAGE;

const REPORTING_PRESET_EXCLUSIONS = {
  all: {
    productivityMetricTypes: [],
    costCategories: [],
  },
  active_only: {
    productivityMetricTypes: ['WEIGHT_GAIN'],
    costCategories: ['TRANSPORT'],
  },
  inactive_only: {
    productivityMetricTypes: ['MILK_LITERS'],
    costCategories: ['FEED'],
  },
} as const satisfies Record<ReportingPresetId, { productivityMetricTypes: readonly string[]; costCategories: readonly string[] }>;

export function coerceReportingWindow(value: string | null | undefined): ReportingWindow {
  return ALLOWED_REPORTING_WINDOWS.includes(value as ReportingWindow)
    ? (value as ReportingWindow)
    : DEFAULT_REPORTING_WINDOW;
}

export function coerceReportingPreset(value: string | null | undefined): ReportingPresetId {
  return ALLOWED_REPORTING_PRESETS.includes(value as ReportingPresetId)
    ? (value as ReportingPresetId)
    : DEFAULT_REPORTING_PRESET;
}

export function resolveReportingPresetExclusions(preset: ReportingPresetId) {
  return REPORTING_PRESET_EXCLUSIONS[preset] as {
    productivityMetricTypes: readonly string[];
    costCategories: readonly string[];
  };
}

export function parseReportingDate(value: string | null | undefined) {
  if (!value?.trim()) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function compareRecentActivityDesc(
  left: Pick<AdminReportingRecentActivityItem, 'occurredAt' | 'sourceType' | 'id'>,
  right: Pick<AdminReportingRecentActivityItem, 'occurredAt' | 'sourceType' | 'id'>
) {
  const occurredAtComparison = right.occurredAt.localeCompare(left.occurredAt);
  if (occurredAtComparison !== 0) {
    return occurredAtComparison;
  }

  const sourceComparison = left.sourceType.localeCompare(right.sourceType);
  if (sourceComparison !== 0) {
    return sourceComparison;
  }

  return left.id.localeCompare(right.id);
}

export function isWithinReportingWindow(occurredAt: string, window: ReportingWindow, nowIso: string) {
  const occurredDate = parseReportingDate(occurredAt);
  const now = parseReportingDate(nowIso) ?? new Date();

  if (!occurredDate) {
    return false;
  }

  const diffMs = now.getTime() - occurredDate.getTime();
  if (diffMs < 0) {
    return false;
  }

  const windowDays = window === '7d' ? 7 : window === '30d' ? 30 : 90;
  return diffMs <= windowDays * 24 * 60 * 60 * 1000;
}

export function matchesReportingPreset(active: boolean | null | undefined, preset: ReportingPresetId) {
  if (preset === 'all') {
    return true;
  }

  if (active == null) {
    return false;
  }

  return preset === 'active_only' ? active : !active;
}

export function buildReportingSourceSignature(
  signatures: Record<string, string | null>,
  selectedWindow: ReportingWindow,
  selectedPreset: ReportingPresetId
) {
  return {
    ...signatures,
    selection: `${selectedWindow}:${selectedPreset}`,
  };
}

export function sameReportingSourceSignature(
  left: Record<string, string | null>,
  right: Record<string, string | null>
) {
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  return Array.from(keys).every((key) => (left[key] ?? null) === (right[key] ?? null));
}

export function buildReportingAnimalLabel(snapshot: Record<string, unknown> | undefined, animalUuid: string) {
  const visible = [snapshot?.['arete'], snapshot?.['marca'], snapshot?.['tatuaje']]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .find(Boolean);

  return visible || animalUuid;
}

export function buildReportingTitle(sourceType: AdminReportingEventSourceType, eventType: string) {
  return `${humanizeEventSource(sourceType)} · ${humanizeEventType(eventType)}`;
}

export function humanizeEventSource(sourceType: AdminReportingEventSourceType) {
  return (
    {
      ANIMAL_EVENT: 'Evento animal',
      ANIMAL_HEALTH_EVENT: 'Evento sanitario',
      ANIMAL_REPRODUCTION_EVENT: 'Evento reproductivo',
    } as const
  )[sourceType];
}

export function humanizeEventType(eventType: string) {
  return eventType
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}
