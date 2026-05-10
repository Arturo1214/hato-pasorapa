import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import { AdminReportingPageComponent } from './admin-reporting-page.component';
import { AdminReportsExportService } from './data-access/admin-reports-export';
import { AdminReportsStore } from './data-access/admin-reports.store';

const exportService = { exportToExcel: vi.fn() };

describe('AdminReportingPageComponent integration', () => {
  let fixture: ComponentFixture<AdminReportingPageComponent>;
  let httpMock: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminReportingPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        AdminReportsStore,
        { provide: AdminReportsExportService, useValue: exportService },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'admin-token' } },
      ],
    }).compileComponents();

    httpMock = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminReportingPageComponent);
  });

  afterEach(() => httpMock.verify());

  it('should load a selected report, render its DataTable rows, and export the loaded dataset', async () => {
    fixture.detectChanges();
    httpMock.expectOne('/api/admin/reports/inventory-by-ganadero').flush({ rows: [] });
    await fixture.whenStable();

    const loadPromise = fixture.componentInstance.selectReport('health-activity');
    const request = httpMock.expectOne('/api/admin/reports/health-activity?from=2026-05-01&to=2026-05-10&limit=200');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
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
    await loadPromise;
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('VACCINATION');
    expect(fixture.nativeElement.textContent).toContain('Ganadero A');

    await fixture.componentInstance.exportCurrentReport();

    expect(exportService.exportToExcel).toHaveBeenCalledWith(
      [expect.objectContaining({ eventId: 'event-a', ganaderoName: 'Ganadero A' })],
      expect.arrayContaining([expect.objectContaining({ key: 'type', label: 'Tipo' })]),
      'ActividadSanitaria'
    );
  });
});
