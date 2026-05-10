import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AdminNotificationsService } from './data-access/admin-notifications.service';
import { AdminNotificationsPageComponent } from './admin-notifications-page.component';

describe('AdminNotificationsPageComponent', () => {
  let fixture: ComponentFixture<AdminNotificationsPageComponent>;
  let overlayContainer: OverlayContainer;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNotificationsPageComponent],
      providers: [
        {
          provide: AdminNotificationsService,
          useValue: {
            listHistory: () =>
              of([
                {
                  id: 'notification-a',
                  title: 'Aviso sanitario',
                  body: 'Vacunación programada',
                  targetingMode: 'ALL_ACTIVE_GANADEROS',
                  includeUserIds: [],
                  excludeUserIds: [],
                  recipientCount: 10,
                  deliveryMetrics: { totalCount: 10, readCount: 7, pendingCount: 3 },
                  createdByUserId: 'admin-a',
                  createdAt: '2026-05-10T09:00:00Z',
                  updatedAt: '2026-05-10T09:00:00Z',
                  publishedAt: '2026-05-10T09:00:00Z',
                },
                {
                  id: 'notification-b',
                  title: 'Borrador sin destinatarios',
                  body: 'Pendiente de envío',
                  targetingMode: 'EXPLICIT_LIST',
                  includeUserIds: [],
                  excludeUserIds: [],
                  recipientCount: 0,
                  deliveryMetrics: null,
                  createdByUserId: 'admin-a',
                  createdAt: '2026-05-10T08:00:00Z',
                  updatedAt: '2026-05-10T08:00:00Z',
                  publishedAt: '2026-05-10T08:00:00Z',
                },
              ]),
            listActiveGanaderoRecipients: () => of([]),
            createNotification: () => of({}),
          },
        },
        { provide: AuthService, useValue: { currentUser: () => ({ role: 'ADMIN' }) } },
        { provide: OfflineStatusService, useValue: { message: signal<string | null>(null) } },
        provideNoopAnimations(),
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    fixture = TestBed.createComponent(AdminNotificationsPageComponent);
    fixture.detectChanges();
  });

  it('should render the real admin notification workflow by default', () => {
    expect(fixture.nativeElement.textContent).toContain('Nueva notificación');
    expect(fixture.nativeElement.textContent).toContain('Historial emitido');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="admin-notifications-tab"]')).toHaveLength(0);
  });

  it('should show delivery metrics in the admin history without local inbox concepts', () => {
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Aviso sanitario');
    expect(text).toContain('Total destinatarios');
    expect(text).toContain('Leídas');
    expect(text).toContain('Pendientes');
    expect(text).toContain('10');
    expect(text).toContain('7');
    expect(text).toContain('3');
    expect(text).toContain('Borrador sin destinatarios');
    expect(text).not.toContain('No leídas');
    expect(text).not.toContain('Refrescar inbox');
    expect(text).not.toContain('Bandeja local');
  });

  it('should open the create notification modal from the toolbar action', () => {
    const createButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((button) =>
      button.textContent?.includes('Nueva notificación')
    ) as HTMLButtonElement;

    createButton.click();
    fixture.detectChanges();

    expect(overlayContainer.getContainerElement().textContent).toContain('Publicar notificación');
  });
});
