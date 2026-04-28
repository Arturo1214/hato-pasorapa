import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AdminNotificationsService } from './data-access/admin-notifications.service';
import { NotificationInboxStore } from './data-access/notification-inbox.store';
import { NotificationInboxPageComponent } from './notification-inbox.page';

describe('NotificationInboxPageComponent', () => {
  let fixture: ComponentFixture<NotificationInboxPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;
  let fakeService: ReturnType<typeof createFakeService>;

  beforeEach(async () => {
    fakeStore = createFakeStore();
    fakeService = createFakeService();

    await TestBed.configureTestingModule({
      imports: [NotificationInboxPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: NotificationInboxStore, useValue: fakeStore },
        { provide: AdminNotificationsService, useValue: fakeService },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'ADMIN', displayName: 'Admin Root' }),
          },
        },
        {
          provide: OfflineStatusService,
          useValue: {
            message: signal<string | null>(null),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(NotificationInboxPageComponent);
    fixture.detectChanges();
  });

  it('should render the explicit local-read copy and unread inbox items', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('leído solo en este dispositivo');
    expect(text).toContain('No leídas: 1');
    expect(text).toContain('Aviso pendiente');
  });

  it('should trigger inbox refresh and mark notifications as read from the page actions', async () => {
    await fixture.componentInstance.refresh();
    fixture.componentInstance.markAsRead('notification-a');

    expect(fakeStore.rebuild).toHaveBeenCalledWith('manual');
    expect(fakeStore.markAsRead).toHaveBeenCalledWith('notification-a');
  });

  it('should allow ADMIN to publish a notification and show emitted history', () => {
    fixture.componentInstance.createForm.setValue({
      title: 'Aviso admin',
      body: 'Mensaje operativo.',
      targetingMode: 'EXPLICIT_LIST',
      includeUserIds: ['ganadero-1'],
      excludeUserIds: [],
    });

    fixture.componentInstance.submitCreate();
    fixture.detectChanges();

    expect(fakeService.createNotification).toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Historial emitido');
  });
});

function createFakeStore() {
  const itemsState = signal([
    {
      id: 'notification-a',
      title: 'Aviso pendiente',
      body: 'Mensaje aún no leído.',
      createdByUserId: 'admin-1',
      publishedAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      read: false,
      readAt: null,
    },
  ]);

  return {
    items: itemsState.asReadonly(),
    unreadCount: () => itemsState().filter((item) => !item.read).length,
    rebuild: vi.fn(async () => undefined),
    markAsRead: vi.fn(async () => undefined),
  };
}

function createFakeService() {
  return {
    listHistory: vi.fn(() =>
      of([
        {
          id: 'history-1',
          title: 'Histórico',
          body: 'Mensaje histórico.',
          targetingMode: 'ALL_ACTIVE_GANADEROS' as const,
          includeUserIds: [],
          excludeUserIds: [],
          recipientCount: 3,
          createdByUserId: 'admin-1',
          createdAt: '2026-04-26T09:00:00.000Z',
          updatedAt: '2026-04-26T09:00:00.000Z',
          publishedAt: '2026-04-26T09:00:00.000Z',
        },
      ])
    ),
    listActiveGanaderoRecipients: vi.fn(() =>
      of([
        { id: 'ganadero-1', displayName: 'Ganadero Uno', username: 'ganadero-1', email: 'ganadero-1@hato.bo' },
      ])
    ),
    createNotification: vi.fn(() =>
      of({
        id: 'created-1',
        title: 'Aviso admin',
        body: 'Mensaje operativo.',
        targetingMode: 'EXPLICIT_LIST' as const,
        includeUserIds: ['ganadero-1'],
        excludeUserIds: [],
        recipientCount: 1,
        createdByUserId: 'admin-1',
        createdAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
        publishedAt: '2026-04-26T10:00:00.000Z',
      })
    ),
  };
}
