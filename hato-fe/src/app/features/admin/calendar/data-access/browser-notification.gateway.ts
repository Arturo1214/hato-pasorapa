import { Injectable } from '@angular/core';
import type { CalendarAlertPreferences, CalendarDerivedAgendaItem } from '../../../../core/offline/offline-types';
import { parseCalendarDate } from './calendar-alerts.utils';

export interface BrowserNotificationDispatchResult {
  browserDelivered: number;
  inAppItems: CalendarDerivedAgendaItem[];
}

interface NotificationApiLike {
  permission: NotificationPermission;
  requestPermission(): Promise<NotificationPermission>;
  create(title: string, options?: NotificationOptions): void;
}

const COOLDOWN_MS = 60 * 60 * 1000;

@Injectable({ providedIn: 'root' })
export class BrowserNotificationGateway {
  private notificationApi = readNotificationApi();
  private now: () => string = () => new Date().toISOString();
  private readonly cooldown = new Map<string, string>();

  configureForTesting(dependencies: Partial<{ notificationApi: NotificationApiLike | null; now: () => string }>) {
    this.notificationApi = dependencies.notificationApi ?? this.notificationApi;
    this.now = dependencies.now ?? this.now;
  }

  permission() {
    return this.notificationApi?.permission ?? 'default';
  }

  async requestPermission() {
    if (!this.notificationApi) {
      return 'default' satisfies NotificationPermission;
    }

    return this.notificationApi.requestPermission();
  }

  async dispatchAlerts(items: CalendarDerivedAgendaItem[], preferences: CalendarAlertPreferences): Promise<BrowserNotificationDispatchResult> {
    // V1 is intentionally best-effort for browser notifications. The in-app list
    // is always returned as fallback and there is no cross-device reminder state.
    const nowIso = this.now();
    const snoozedUntil = parseCalendarDate(preferences.snoozedUntil ?? null);
    if (snoozedUntil && snoozedUntil > (parseCalendarDate(nowIso) ?? new Date())) {
      return { browserDelivered: 0, inAppItems: items };
    }

    if (!preferences.notificationsEnabled || !this.notificationApi || this.notificationApi.permission !== 'granted') {
      return { browserDelivered: 0, inAppItems: items };
    }

    let browserDelivered = 0;
    for (const item of items) {
      const lastSentAt = this.cooldown.get(item.id);
      if (lastSentAt && !isCooldownExpired(lastSentAt, nowIso)) {
        continue;
      }

      this.notificationApi.create(item.title, {
        body: item.detail,
        tag: item.id,
      });
      this.cooldown.set(item.id, nowIso);
      browserDelivered += 1;
    }

    return { browserDelivered, inAppItems: items };
  }
}

function readNotificationApi(): NotificationApiLike | null {
  const notificationRef = globalThis.Notification as typeof Notification | undefined;
  if (!notificationRef) {
    return null;
  }

  return {
    get permission() {
      return notificationRef.permission;
    },
    requestPermission: () => notificationRef.requestPermission(),
    create: (title, options) => {
      new notificationRef(title, options);
    },
  };
}

function isCooldownExpired(lastSentAt: string, nowIso: string) {
  const last = parseCalendarDate(lastSentAt);
  const now = parseCalendarDate(nowIso);
  if (!last || !now) {
    return true;
  }

  return now.getTime() - last.getTime() >= COOLDOWN_MS;
}
