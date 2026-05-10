import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AdminReportsService } from './admin-reports.service';

describe('AdminReportsService', () => {
  let service: AdminReportsService;
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

    service = TestBed.inject(AdminReportsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should request inventory by ganadero with typed optional filters and auth headers', () => {
    let rows = 0;

    service.getInventoryByGanadero({ ganaderoId: 42, active: true }).subscribe((response) => {
      rows = response.rows.length;
    });

    const request = httpMock.expectOne('/api/admin/reports/inventory-by-ganadero?ganaderoId=42&active=true');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-a');
    request.flush({ rows: [{ ganaderoId: 42, ganaderoName: 'Don Arturo', total: 3, active: 2, inactive: 1, byCategory: {}, bySex: {} }] });

    expect(rows).toBe(1);
  });

  it('should serialize date windows, limits, and specific filters for health activity', () => {
    let eventId = '';

    service
      .getHealthActivity({ from: '2026-05-01', to: '2026-05-10', type: 'VACCINATION', ganaderoId: 7, animalUuid: 'animal-a', limit: 25 })
      .subscribe((response) => {
        eventId = response.rows[0].eventId;
      });

    const request = httpMock.expectOne(
      '/api/admin/reports/health-activity?from=2026-05-01&to=2026-05-10&type=VACCINATION&ganaderoId=7&animalUuid=animal-a&limit=25'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      rows: [
        {
          eventId: 'event-a',
          occurredAt: '2026-05-09T10:00:00Z',
          type: 'VACCINATION',
          ganaderoId: 7,
          ganaderoName: 'Ganadero A',
          animalUuid: 'animal-a',
          animalCode: 'A-1',
          animalTag: 'TAG-1',
          notes: 'Primera dosis',
        },
      ],
    });

    expect(eventId).toBe('event-a');
  });

  it('should include targetingMode in notification reach rows and omit empty params', () => {
    let targetingMode = '';

    service.getNotificationReach({ from: '2026-05-01', to: undefined, targetingMode: 'EXPLICIT_LIST', limit: 50 }).subscribe((response) => {
      targetingMode = response.rows[0].targetingMode;
    });

    const request = httpMock.expectOne('/api/admin/reports/notification-reach?from=2026-05-01&targetingMode=EXPLICIT_LIST&limit=50');
    expect(request.request.method).toBe('GET');
    request.flush({
      rows: [
        {
          notificationId: 'notification-a',
          title: 'Aviso',
          publishedAt: '2026-05-09T10:00:00Z',
          targetingMode: 'ALL_ACTIVE_GANADEROS',
          totalRecipients: 10,
          readCount: 7,
          pendingCount: 3,
          readRate: 70,
        },
      ],
    });

    expect(targetingMode).toBe('ALL_ACTIVE_GANADEROS');
  });

  it('should map backend failures to a report loading error', () => {
    let message = '';

    service.getInventoryByGanadero().subscribe({
      error: (error: Error) => {
        message = error.message;
      },
    });

    const request = httpMock.expectOne('/api/admin/reports/inventory-by-ganadero');
    request.flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(message).toBe('No pudimos cargar el reporte administrativo.');
  });
});
