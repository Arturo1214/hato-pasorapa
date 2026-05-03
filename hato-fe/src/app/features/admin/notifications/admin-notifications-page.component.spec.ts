import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AdminNotificationsService } from './data-access/admin-notifications.service';
import { NotificationInboxStore } from './data-access/notification-inbox.store';
import { AdminNotificationsPageComponent } from './admin-notifications-page.component';

describe('AdminNotificationsPageComponent', () => {
  let fixture: ComponentFixture<AdminNotificationsPageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNotificationsPageComponent],
      providers: [
        {
          provide: NotificationInboxStore,
          useValue: { items: signal([]).asReadonly(), unreadCount: () => 0, rebuild: vi.fn(), markAsRead: vi.fn() },
        },
        {
          provide: AdminNotificationsService,
          useValue: {
            listHistory: () => of([]),
            listActiveGanaderoRecipients: () => of([]),
            createNotification: () => of({}),
            markRecipientAsRead: () => of(undefined),
            markAllAsRead: () => of(undefined),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ role: 'ADMIN' }) } },
        { provide: OfflineStatusService, useValue: { message: signal<string | null>(null) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminNotificationsPageComponent);
    fixture.detectChanges();
  });

  it('should have 3 tabs and render administration by default', () => {
    const tabButtons = fixture.nativeElement.querySelectorAll('[data-testid="admin-notifications-tab"]');

    expect(tabButtons).toHaveLength(3);
    expect(fixture.nativeElement.textContent).toContain('Administración');
  });

  it('should switch to creation tab on click', () => {
    const createTab = fixture.nativeElement.querySelector('[data-tab="creation"]') as HTMLButtonElement;
    createTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Nueva notificación');
  });

  it('should switch to history tab on click', () => {
    const historyTab = fixture.nativeElement.querySelector('[data-tab="history"]') as HTMLButtonElement;
    historyTab.click();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Historial emitido');
  });
});
