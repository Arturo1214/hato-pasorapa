import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AdminDashboardService } from './data-access/admin-dashboard.service';
import { AdminDashboardPageComponent } from './admin-dashboard-page.component';

describe('AdminDashboardPageComponent', () => {
  const configure = async (serviceMock: Pick<AdminDashboardService, 'loadMetrics'>) => {
    await TestBed.configureTestingModule({
      imports: [AdminDashboardPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AdminDashboardService,
          useValue: serviceMock,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AdminDashboardPageComponent);
    fixture.detectChanges();
    return fixture;
  };

  it('should render user metrics cards for administrators', async () => {
    const fixture = await configure({
      loadMetrics: () =>
        of({
          admins: { total: 2, active: 1, inactive: 1, blocked: 0 },
          ganaderos: { total: 3, active: 2, inactive: 1, blocked: 0 },
        }),
    });

    expect(fixture.nativeElement.textContent).toContain('Administradores');
    expect(fixture.nativeElement.textContent).toContain('Ganaderos usuario');
    expect(fixture.nativeElement.textContent).toContain('2');
    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('should show a clear error state when dashboard metrics cannot be loaded', async () => {
    const fixture = await configure({
      loadMetrics: () => throwError(() => new Error('boom')),
    });

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el dashboard administrativo.');
  });
});
