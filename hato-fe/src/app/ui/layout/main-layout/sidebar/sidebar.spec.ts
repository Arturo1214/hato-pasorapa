import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { CalendarAlertsStore } from '../../../../features/admin/calendar/data-access/calendar-alerts.store';
import { AdminConflictResolutionStore } from '../../../../features/admin/conflicts/data-access/admin-conflict-resolution.store';
import { SidebarComponent } from './sidebar';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;

  const configure = async (role: 'ADMIN' | 'GANADERO') => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
          provideRouter([]),
          {
            provide: CalendarAlertsStore,
            useValue: {
              totalPending: () => 2,
              badgeSeverity: () => 'overdue',
            },
          },
          {
            provide: AdminConflictResolutionStore,
            useValue: {
              unresolvedCount: () => 3,
            },
          },
          {
            provide: ApplicationConfigService,
            useValue: { config: () => ({ apiBaseUrl: '/api', offlineBackupV1Enabled: true }) },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role, displayName: role === 'ADMIN' ? 'Admin Root' : 'Ganadero Base' }),
            logout: vi.fn(),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
  };

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
  });

  it('should show admin navigation entries for administrative management', async () => {
    await configure('ADMIN');

    const labels = fixture.componentInstance.menuItems().map((item) => item.label);

    expect(labels).toEqual(['Dashboard', 'Usuarios', 'Ganaderos', 'Notificaciones', 'Reportes']);
    expect(labels).toHaveLength(5);
  });

  it('should expose the role-ordered ganadero sidebar entries', async () => {
    await configure('GANADERO');

    const labels = fixture.componentInstance.menuItems().map((item) => item.label);

    expect(labels).toEqual([
      'Dashboard',
      'Animales',
      'Visitas veterinarias',
      'Calendario',
      'Notificaciones',
      'Sincronización',
      'Backups',
      'Conflictos',
    ]);
    expect(labels).toHaveLength(8);
  });

  it('should render the operational badge for calendario entries', async () => {
    await configure('GANADERO');

    const badges = Array.from(fixture.nativeElement.querySelectorAll('.menu-badge')) as HTMLElement[];
    expect(badges.some((badge) => badge.textContent?.includes('3') && badge.getAttribute('data-severity') === 'high')).toBe(true);
    expect(badges.some((badge) => badge.textContent?.includes('2') && badge.getAttribute('data-severity') === 'overdue')).toBe(true);
    expect(badges.some((badge) => badge.textContent?.includes('1') && badge.getAttribute('data-severity') === 'info')).toBe(false);
  });
});
