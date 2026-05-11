import { computed, Injectable, signal } from '@angular/core';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import {
  type CalendarAlertPreferences,
  type CalendarDerivedAgendaItem,
  type CalendarDerivedState,
  type CalendarRange,
} from '../../../../core/offline/offline-types';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { CALENDAR_ALERTS_REFRESH_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import { projectCalendarAlerts, selectCalendarTimeline } from './calendar-alerts-projection';
import { BrowserNotificationGateway } from './browser-notification.gateway';
import {
  CALENDAR_STALE_TIME_MS,
  DEFAULT_CALENDAR_ALERT_PREFERENCES,
  isCalendarStateStale,
} from './calendar-alerts.utils';

export type CalendarRefreshReason = 'startup' | 'post-sync' | 'prefs-change' | 'manual' | 'stale-guard';

@Injectable({ providedIn: 'root' })
export class CalendarAlertsStore {
  // V1 exclusions: no push remota, no motor experto y sin estado compartido entre dispositivos.
  private offlineStore: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private authService: Pick<AuthService, 'currentUser'> = { currentUser: () => null } as Pick<AuthService, 'currentUser'>;
  private gateway = new BrowserNotificationGateway();
  private now: () => string = () => new Date().toISOString();
  private windowRef: Pick<Window, 'addEventListener'> | undefined = globalThis.window;
  private initialized = false;

  private readonly state = signal<CalendarDerivedState>({
    version: 1,
    preferences: DEFAULT_CALENDAR_ALERT_PREFERENCES,
    items: [],
    windows: { upcoming: [], due_today: [], overdue: [] },
    counts: { total: 0, byStatus: { upcoming: 0, due_today: 0, overdue: 0 } },
    lastComputedAt: null,
  });
  private readonly activeRange = signal<CalendarRange>('today');
  private readonly loadingState = signal(false);
  private readonly lastReasonState = signal<CalendarRefreshReason | null>(null);
  private readonly errorState = signal<string | null>(null);
  private readonly inAppAlertsState = signal<CalendarDerivedAgendaItem[]>([]);

  readonly range = this.activeRange.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly lastReason = this.lastReasonState.asReadonly();
  readonly preferences = computed(() => this.state().preferences);
  readonly windows = computed(() => this.state().windows);
  readonly counts = computed(() => this.state().counts);
  readonly totalPending = computed(() => this.state().counts.total);
  readonly badgeSeverity = computed(() => {
    const counts = this.state().counts.byStatus;
    if (counts.overdue > 0) {
      return 'overdue' as const;
    }
    if (counts.due_today > 0) {
      return 'due_today' as const;
    }
    return counts.upcoming > 0 ? ('upcoming' as const) : null;
  });
  readonly timeline = computed(() => selectCalendarTimeline(this.state(), this.activeRange(), this.now()));
  readonly stale = computed(() => isCalendarStateStale(this.state().lastComputedAt, this.now(), CALENDAR_STALE_TIME_MS));
  readonly inAppAlerts = this.inAppAlertsState.asReadonly();

  constructor(authService?: AuthService) {
    this.authService = authService ?? this.authService;
  }

  configureForTesting(
    dependencies: Partial<{
      offlineStore: OfflineStoreService;
      authService: Pick<AuthService, 'currentUser'>;
      gateway: BrowserNotificationGateway;
      now: () => string;
      windowRef: Pick<Window, 'addEventListener'>;
    }>
  ) {
    this.offlineStore = dependencies.offlineStore ?? this.offlineStore;
    this.authService = dependencies.authService ?? this.authService;
    this.gateway = dependencies.gateway ?? this.gateway;
    this.now = dependencies.now ?? this.now;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  async initialize() {
    if (!this.initialized) {
      this.initialized = true;
      this.windowRef?.addEventListener(CALENDAR_ALERTS_REFRESH_EVENT, () => {
        void this.rebuild('post-sync');
      });
    }

    const persisted = await this.offlineStore.getCalendarAlertsState();
    if (persisted) {
      this.state.set(persisted);
    }

    await this.rebuild('startup');
  }

  async ensureFresh() {
    if (this.stale()) {
      await this.rebuild('stale-guard');
    }
  }

  setRange(range: CalendarRange) {
    this.activeRange.set(range);
  }

  async setHorizonDays(horizonDays: CalendarAlertPreferences['horizonDays']) {
    await this.updatePreferences({ horizonDays });
  }

  async setNotificationsEnabled(notificationsEnabled: boolean) {
    await this.updatePreferences({ notificationsEnabled });
  }

  async snooze(hours = 3) {
    const next = new Date(this.now());
    next.setHours(next.getHours() + hours);
    await this.updatePreferences({ snoozedUntil: next.toISOString() });
  }

  async clearSnooze() {
    await this.updatePreferences({ snoozedUntil: null });
  }

  async requestBrowserPermission() {
    return this.gateway.requestPermission();
  }

  async rebuild(reason: CalendarRefreshReason) {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const animals = this.filterAnimalsForCurrentGanadero(await this.offlineStore.listSnapshots('ANIMAL'));
      const allowedAnimalUuids = new Set(animals.map((snapshot) => snapshot.entityId));
      const state = projectCalendarAlerts({
        now: this.now(),
        preferences: this.state().preferences,
        animals,
        animalEvents: this.filterAnimalScopedSnapshots(await this.offlineStore.listSnapshots('ANIMAL_EVENT'), allowedAnimalUuids),
        healthEvents: this.filterClosedGlobalVetVisitChains(
          this.filterAnimalScopedSnapshots(await this.offlineStore.listSnapshots('ANIMAL_HEALTH_EVENT'), allowedAnimalUuids)
        ),
        reproductionEvents: this.filterAnimalScopedSnapshots(await this.offlineStore.listSnapshots('ANIMAL_REPRODUCTION_EVENT'), allowedAnimalUuids),
      });

      this.state.set(state);
      this.lastReasonState.set(reason);
      await this.offlineStore.setCalendarAlertsState(state);

      const notifications = await this.gateway.dispatchAlerts(
        [...state.windows.overdue, ...state.windows.due_today, ...state.windows.upcoming],
        state.preferences
      );
      this.inAppAlertsState.set(notifications.inAppItems);
    } catch {
      this.errorState.set('No pudimos recalcular la agenda local.');
    } finally {
      this.loadingState.set(false);
    }
  }

  private async updatePreferences(patch: Partial<CalendarAlertPreferences>) {
    this.state.update((current) => ({
      ...current,
      preferences: {
        ...current.preferences,
        ...patch,
      },
    }));
    await this.rebuild('prefs-change');
  }

  private filterAnimalsForCurrentGanadero(animals: Awaited<ReturnType<OfflineStoreService['listSnapshots']>>) {
    const currentUser = this.authService.currentUser();
    if (currentUser?.role !== 'GANADERO') {
      return animals;
    }

    if (!currentUser.ganaderoId) {
      return [];
    }

    return animals.filter((snapshot) => {
      const ownerGanaderoId = snapshot.payload['ownerGanaderoId'];
      return ownerGanaderoId === currentUser.ganaderoId || ownerGanaderoId === 'SESSION_GANADERO';
    });
  }

  private filterAnimalScopedSnapshots(
    snapshots: Awaited<ReturnType<OfflineStoreService['listSnapshots']>>,
    allowedAnimalUuids: Set<string>
  ) {
    const currentUser = this.authService.currentUser();
    if (currentUser?.role !== 'GANADERO') {
      return snapshots;
    }

    return snapshots.filter((snapshot) => {
      const animalUuid = snapshot.payload['animalUuid'];
      return typeof animalUuid === 'string' && allowedAnimalUuids.has(animalUuid);
    });
  }

  private filterClosedGlobalVetVisitChains(snapshots: Awaited<ReturnType<OfflineStoreService['listSnapshots']>>) {
    const globalVisitsById = new Map<string, Awaited<ReturnType<OfflineStoreService['listSnapshots']>>>();
    for (const snapshot of snapshots) {
      const visit = readGlobalVisitBlock(snapshot.payload);
      if (!visit?.visitId) {
        continue;
      }
      globalVisitsById.set(visit.visitId, [...(globalVisitsById.get(visit.visitId) ?? []), snapshot]);
    }

    const closedVisitIds = new Set(
      [...globalVisitsById.entries()]
        .filter(([, chain]) => chain.length > 0 && chain.every((snapshot) => isTerminalVisitStatus(readGlobalVisitBlock(snapshot.payload)?.status)))
        .map(([visitId]) => visitId)
    );

    return snapshots.filter((snapshot) => {
      const visit = readGlobalVisitBlock(snapshot.payload);
      return !visit?.visitId || !closedVisitIds.has(visit.visitId);
    });
  }
}

function readGlobalVisitBlock(payload: Record<string, unknown>) {
  if (payload['healthEventType'] !== 'FIELD_VET_VISIT') {
    return null;
  }
  const metadata = payload['metadata'];
  if (typeof metadata !== 'object' || metadata === null || !('visit' in metadata)) {
    return null;
  }
  const visit = (metadata as Record<string, unknown>)['visit'];
  if (typeof visit !== 'object' || visit === null) {
    return null;
  }
  const block = visit as Record<string, unknown>;
  if (block['mode'] !== 'GLOBAL' || typeof block['visitId'] !== 'string') {
    return null;
  }
  return { visitId: block['visitId'], status: block['status'] };
}

function isTerminalVisitStatus(status: unknown) {
  return status === 'FINALIZED' || status === 'CANCELED' || status === 'FINALIZADA' || status === 'CANCELADA';
}
