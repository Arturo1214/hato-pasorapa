import type { CalendarDerivedAgendaItem } from '../../../../core/offline/offline-types';
import { BrowserNotificationGateway } from './browser-notification.gateway';

describe('BrowserNotificationGateway', () => {
  const item: CalendarDerivedAgendaItem = {
    id: 'agenda-1',
    animalUuid: 'animal-1',
    sourceType: 'ANIMAL_HEALTH_EVENT',
    sourceId: 'health-1',
    dueAt: '2026-04-27T12:00:00.000Z',
    status: 'due_today',
    title: 'Vacunación pendiente',
    detail: 'BO-001',
    priorityScore: 100,
    sortKey: 'ANIMAL_HEALTH_EVENT:health-1',
  };

  it('should gracefully degrade to in-app alerts when permission is default or denied', async () => {
    const create = vi.fn();
    const gateway = new BrowserNotificationGateway();
    gateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'default',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'denied'),
        create,
      },
    });

    const result = await gateway.dispatchAlerts([item], {
      horizonDays: 3,
      notificationsEnabled: true,
      snoozedUntil: null,
    });

    expect(result.browserDelivered).toBe(0);
    expect(result.inAppItems).toEqual([item]);
    expect(create).not.toHaveBeenCalled();
  });

  it('should honor cooldown when permission is granted', async () => {
    const create = vi.fn();
    const gateway = new BrowserNotificationGateway();
    gateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'granted',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'granted'),
        create,
      },
    });

    await gateway.dispatchAlerts([item], {
      horizonDays: 3,
      notificationsEnabled: true,
      snoozedUntil: null,
    });
    await gateway.dispatchAlerts([item], {
      horizonDays: 3,
      notificationsEnabled: true,
      snoozedUntil: null,
    });

    expect(create).toHaveBeenCalledTimes(1);
  });

  it('should skip browser delivery while the local reminder is snoozed', async () => {
    const create = vi.fn();
    const gateway = new BrowserNotificationGateway();
    gateway.configureForTesting({
      now: () => '2026-04-27T10:00:00.000Z',
      notificationApi: {
        permission: 'granted',
        requestPermission: vi.fn(async (): Promise<NotificationPermission> => 'granted'),
        create,
      },
    });

    const result = await gateway.dispatchAlerts([item], {
      horizonDays: 3,
      notificationsEnabled: true,
      snoozedUntil: '2026-04-27T12:00:00.000Z',
    });

    expect(result.browserDelivered).toBe(0);
    expect(result.inAppItems).toEqual([item]);
    expect(create).not.toHaveBeenCalled();
  });
});
