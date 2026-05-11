import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { VetVisitsService } from './vet-visits.service';

describe('VetVisitsService', () => {
  let service: VetVisitsService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token-vet' } },
      ],
    });

    service = TestBed.inject(VetVisitsService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('should request vet visits with filters, auth header, and normalized pagination defaults', () => {
    const received: string[] = [];

    service
      .listVetVisits({ mode: 'GLOBAL', status: 'PENDING', veterinarian: 'Dra. Luna', occurredFrom: '2026-05-01' })
      .subscribe((items) => received.push(items[0].visitId));

    const request = httpMock.expectOne(
      '/api/vet-visits?mode=GLOBAL&status=PENDING&veterinarian=Dra.%20Luna&occurredFrom=2026-05-01&page=0&size=20',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-vet');
    request.flush({
      items: [
        {
          visitId: 'visit-global-1',
          mode: 'GLOBAL',
          status: 'PENDING',
          veterinarian: { name: 'Dra. Luna', license: 'MV-001' },
          occurredAt: '2026-05-10T10:00:00Z',
          nextControlAt: null,
          animalUuid: null,
          targetAnimalCount: 12,
          atencionNotas: null,
        },
      ],
      page: 0,
      size: 20,
      total: 1,
    });

    expect(received).toEqual(['visit-global-1']);
  });

  it('should omit empty filters and keep explicit pagination values', () => {
    let count = 0;

    service.listVetVisits({ mode: '', status: null, page: 2, size: 5 }).subscribe((items) => {
      count = items.length;
    });

    const request = httpMock.expectOne('/api/vet-visits?page=2&size=5');
    expect(request.request.method).toBe('GET');
    request.flush({ items: [], page: 2, size: 5, total: 0 });

    expect(count).toBe(0);
  });
});
