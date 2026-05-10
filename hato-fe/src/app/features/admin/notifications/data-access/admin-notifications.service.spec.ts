import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AdminNotificationsService, type AdminNotificationRecord } from './admin-notifications.service';

describe('AdminNotificationsService', () => {
  let service: AdminNotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token-a' } },
      ],
    });

    service = TestBed.inject(AdminNotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should map delivery metrics from the admin notifications list response', () => {
    let result: AdminNotificationRecord[] = [];

    service.listHistory().subscribe((notifications) => {
      result = notifications;
    });

    const request = httpMock.expectOne('/api/admin/notifications');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-a');
    request.flush({
      notifications: [
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
      ],
    });

    expect(result[0].deliveryMetrics).toEqual({ totalCount: 10, readCount: 7, pendingCount: 3 });
  });

  it('should keep create responses valid when delivery metrics are absent', () => {
    let result: AdminNotificationRecord | null = null;

    service
      .createNotification({
        title: 'Nuevo aviso',
        body: 'Contenido',
        targetingMode: 'EXPLICIT_LIST',
        includeUserIds: ['ganadero-a'],
        excludeUserIds: [],
      })
      .subscribe((notification) => {
        result = notification;
      });

    const request = httpMock.expectOne('/api/admin/notifications');
    expect(request.request.method).toBe('POST');
    request.flush({
      id: 'notification-b',
      title: 'Nuevo aviso',
      body: 'Contenido',
      targetingMode: 'EXPLICIT_LIST',
      includeUserIds: ['ganadero-a'],
      excludeUserIds: [],
      recipientCount: 1,
      createdByUserId: 'admin-a',
      createdAt: '2026-05-10T09:00:00Z',
      updatedAt: '2026-05-10T09:00:00Z',
      publishedAt: '2026-05-10T09:00:00Z',
    });

    expect(result).toEqual(expect.objectContaining({ deliveryMetrics: null }));
  });
});
