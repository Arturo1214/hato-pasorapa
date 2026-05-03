import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { GanaderoDashboardService } from './ganadero-dashboard.service';

describe('GanaderoDashboardService', () => {
  let service: GanaderoDashboardService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        GanaderoDashboardService,
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: {
            getAccessToken: () => 'token-value',
          },
        },
      ],
    });

    service = TestBed.inject(GanaderoDashboardService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should expose dashboard signals with empty defaults', () => {
    expect(service.animalsSummary()).toBeNull();
    expect(service.upcomingEvents()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    expect(service.upcomingVisits()).toEqual([]);
  });

  it('should load the four ganadero dashboard endpoints without sending ganaderoId', () => {
    service.loadDashboard();

    const animalsSummaryRequest = httpMock.expectOne('/api/ganadero/dashboard/animals-summary');
    const upcomingEventsRequest = httpMock.expectOne('/api/ganadero/dashboard/upcoming-events?limit=5');
    const unreadCountRequest = httpMock.expectOne('/api/ganadero/dashboard/unread-count');
    const upcomingVisitsRequest = httpMock.expectOne('/api/ganadero/dashboard/upcoming-visits?limit=5');

    expect(animalsSummaryRequest.request.params.has('ganaderoId')).toBe(false);
    expect(upcomingEventsRequest.request.params.has('ganaderoId')).toBe(false);
    expect(unreadCountRequest.request.params.has('ganaderoId')).toBe(false);
    expect(upcomingVisitsRequest.request.params.has('ganaderoId')).toBe(false);

    animalsSummaryRequest.flush({
      machos: { vaquillas: 0, vacas: 0, toros: 1, terneros: 2, bueyes: 0 },
      hembras: { vaquillas: 1, vacas: 3, toros: 0, terneros: 1, bueyes: 0 },
    });
    upcomingEventsRequest.flush([{ id: 'event-1', eventType: 'GENERAL', eventDate: '2026-05-10', description: 'Revisión' }]);
    unreadCountRequest.flush({ count: 4 });
    upcomingVisitsRequest.flush([
      { id: 'visit-1', controlType: 'FIELD_VET_VISIT', plannedDate: '2026-05-11', status: 'PENDIENTE' },
    ]);

    expect(service.animalsSummary()?.machos.toros).toBe(1);
    expect(service.upcomingEvents()).toHaveLength(1);
    expect(service.unreadCount()).toBe(4);
    expect(service.upcomingVisits()).toHaveLength(1);
  });
});
