import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { GanaderoNotificationsService, type GanaderoNotificationInboxItem } from './ganadero-notifications.service';
import { GanaderoNotificationsStore } from './ganadero-notifications.store';

const unreadNotification: GanaderoNotificationInboxItem = {
  recipientId: 'recipient-1',
  id: 'notification-1',
  title: 'Control sanitario',
  body: 'Revisá el calendario sanitario.',
  read: false,
  readAt: null,
  publishedAt: '2026-05-10T10:00:00Z',
};

const readNotification: GanaderoNotificationInboxItem = {
  ...unreadNotification,
  recipientId: 'recipient-2',
  id: 'notification-2',
  title: 'Aviso leído',
  read: true,
  readAt: '2026-05-10T11:00:00Z',
};

describe('GanaderoNotificationsStore', () => {
  const service = {
    getInbox: vi.fn(),
    getUnreadCount: vi.fn(),
    markAsRead: vi.fn(),
    markAllAsRead: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service.getInbox.mockReturnValue(of({}));
    service.getUnreadCount.mockReturnValue(of(0));
    service.markAsRead.mockReturnValue(of(undefined));
    service.markAllAsRead.mockReturnValue(of(undefined));

    TestBed.configureTestingModule({
      providers: [
        GanaderoNotificationsStore,
        { provide: GanaderoNotificationsService, useValue: service },
      ],
    });
  });

  it('should refresh inbox items and unread count from server responses', async () => {
    service.getInbox.mockReturnValue(of([unreadNotification, readNotification]));
    service.getUnreadCount.mockReturnValue(of(1));
    const store = TestBed.inject(GanaderoNotificationsStore);

    await store.refresh();

    expect(store.items()).toEqual([unreadNotification, readNotification]);
    expect(store.unreadCount()).toBe(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('should refresh server state after marking one or all notifications as read', async () => {
    service.getInbox.mockReturnValueOnce(of([unreadNotification])).mockReturnValueOnce(of([{ ...unreadNotification, read: true }])).mockReturnValueOnce(of([]));
    service.getUnreadCount.mockReturnValueOnce(of(1)).mockReturnValueOnce(of(0)).mockReturnValueOnce(of(0));
    const store = TestBed.inject(GanaderoNotificationsStore);

    await store.refresh();
    await store.markAsRead('recipient-1');
    await store.markAllAsRead();

    expect(service.markAsRead).toHaveBeenCalledWith('recipient-1');
    expect(service.markAllAsRead).toHaveBeenCalled();
    expect(store.unreadCount()).toBe(0);
  });

  it('should expose a Spanish error message when the inbox cannot be loaded', async () => {
    service.getInbox.mockReturnValue(throwError(() => new Error('network')));
    const store = TestBed.inject(GanaderoNotificationsStore);

    await store.refresh();

    expect(store.error()).toBe('No pudimos cargar tus notificaciones. Intentá nuevamente.');
    expect(store.loading()).toBe(false);
  });
});
