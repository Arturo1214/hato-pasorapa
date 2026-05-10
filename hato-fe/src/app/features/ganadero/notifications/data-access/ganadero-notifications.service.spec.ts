import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { GanaderoNotificationsService } from './ganadero-notifications.service';

describe('GanaderoNotificationsService', () => {
  let service: GanaderoNotificationsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token-ganadero' } },
      ],
    });

    service = TestBed.inject(GanaderoNotificationsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should list the authenticated ganadero inbox from the server source of truth', () => {
    const result: unknown[] = [];

    service.getInbox().subscribe((items) => result.push(...items));

    const request = httpMock.expectOne('/api/notifications/inbox');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-ganadero');
    request.flush({
      notifications: [
        {
          recipientId: 'recipient-1',
          id: 'notification-1',
          title: 'Vacunación',
          body: 'Programá la vacunación del lote A.',
          read: false,
          readAt: null,
          publishedAt: '2026-05-10T10:00:00Z',
        },
      ],
    });

    expect(result).toEqual([
      expect.objectContaining({ recipientId: 'recipient-1', title: 'Vacunación', read: false }),
    ]);
  });

  it('should call unread count and read receipt endpoints without device-local state', () => {
    let unreadCount = -1;

    service.getUnreadCount().subscribe((count) => {
      unreadCount = count;
    });
    service.markAsRead('recipient-1').subscribe();
    service.markAllAsRead().subscribe();

    const unreadCountRequest = httpMock.expectOne('/api/notifications/unread-count');
    expect(unreadCountRequest.request.method).toBe('GET');
    unreadCountRequest.flush({ unreadCount: 3 });

    const markOneRequest = httpMock.expectOne('/api/notifications/recipients/recipient-1/read');
    expect(markOneRequest.request.method).toBe('PATCH');
    markOneRequest.flush({});

    const markAllRequest = httpMock.expectOne('/api/notifications/recipients/read');
    expect(markAllRequest.request.method).toBe('PATCH');
    markAllRequest.flush({});

    expect(unreadCount).toBe(3);
  });
});
