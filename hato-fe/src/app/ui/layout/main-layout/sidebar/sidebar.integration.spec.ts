import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { CalendarAlertsStore } from '../../../../features/admin/calendar/data-access/calendar-alerts.store';
import { AdminConflictResolutionStore } from '../../../../features/admin/conflicts/data-access/admin-conflict-resolution.store';
import { SidebarComponent } from './sidebar';

describe('SidebarComponent integration', () => {
  let fixture: ComponentFixture<SidebarComponent>;
  const currentUserState = signal<{ role: 'ADMIN' | 'GANADERO'; displayName: string }>({
    role: 'ADMIN',
    displayName: 'Admin Root',
  });

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: CalendarAlertsStore, useValue: { totalPending: () => 2, badgeSeverity: () => 'overdue' } },
        { provide: AdminConflictResolutionStore, useValue: { unresolvedCount: () => 3 } },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api', offlineBackupV1Enabled: true }) } },
        { provide: AuthService, useValue: { currentUser: currentUserState, logout: vi.fn() } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
  });

  it('should switch from admin menu to ganadero menu when the role changes', () => {
    expect(fixture.componentInstance.menuItems().map((item) => item.label)).toEqual([
      'Panel',
      'Usuarios',
      'Ganaderos',
      'Razas',
      'Notificaciones',
      'Reportes',
    ]);

    currentUserState.set({ role: 'GANADERO', displayName: 'Ganadero Base' });
    fixture.detectChanges();

    expect(fixture.componentInstance.menuItems().map((item) => item.label)).toEqual([
      'Panel',
      'Animales',
      'Visitas veterinarias',
      'Calendario',
      'Notificaciones',
    ]);
  });
});
