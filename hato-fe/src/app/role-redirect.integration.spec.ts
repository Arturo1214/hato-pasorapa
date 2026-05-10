import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { ApplicationConfigService } from './core/config/application-config.service';
import { AuthService, type SessionUser } from './core/auth/data-access/auth.service';
import { AdminDashboardService } from './features/admin/dashboard/data-access/admin-dashboard.service';
import { AnimalsService } from './features/admin/animals/data-access/animals.service';
import { AdminUsersService } from './features/admin/users/data-access/admin-users.service';
import { GanaderosService } from './features/admin/ganaderos/data-access/ganaderos.service';

class RoleRedirectAuthServiceStub {
  private readonly currentUserState = signal<SessionUser | null>(null);
  private readonly accessToken = signal<string | null>(null);
  private readonly offlineSessionStatus = signal<'active' | 'reauth_required' | 'expired'>('reauth_required');

  readonly loading = signal(false);
  readonly isAuthenticated = computed(() => !!this.accessToken() && this.offlineSessionStatus() === 'active');
  readonly currentUser = this.currentUserState.asReadonly();

  getOfflineSessionStatus() {
    return this.offlineSessionStatus();
  }

  getAccessToken() {
    return this.accessToken();
  }

  setRole(role: 'ADMIN' | 'GANADERO') {
    this.accessToken.set('token');
    this.offlineSessionStatus.set('active');
    this.currentUserState.set({
      id: 'user-id',
      ganaderoId: role === 'GANADERO' ? 'ganadero-id' : null,
      username: role.toLowerCase(),
      email: role.toLowerCase() + '@hato.bo',
      displayName: role,
      role,
      status: 'ACTIVE',
      version: 1,
      updatedAt: '2026-05-01T00:00:00Z',
      lastSyncedAt: null,
    });
  }

  clear() {
    this.accessToken.set(null);
    this.offlineSessionStatus.set('reauth_required');
    this.currentUserState.set(null);
  }
}

describe('role redirect integration', () => {
  const configure = async () => {
    const authService = new RoleRedirectAuthServiceStub();

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: authService },
        { provide: AdminDashboardService, useValue: { loadMetrics: () => of({ admins: { total: 1, active: 1, inactive: 0, blocked: 0 }, ganaderos: { total: 1, active: 1, inactive: 0, blocked: 0 } }) } },
        { provide: AnimalsService, useValue: { listAnimals: () => of([]), createAnimal: () => of({}), updateAnimal: () => of({}), syncState: signal({ pending: 0, syncing: false, lastSyncAt: null, lastMessage: null, manualRefreshRequired: false }) } },
        { provide: AdminUsersService, useValue: { listUsers: () => of([]) } },
        { provide: GanaderosService, useValue: { listGanaderos: () => of([]) } },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create('/');
    return { harness, authService, router: TestBed.inject(Router) };
  };

  it('should redirect ADMIN from root to /admin/dashboard', async () => {
    const { harness, authService, router } = await configure();
    authService.setRole('ADMIN');

    await harness.navigateByUrl('/');

    expect(router.url).toBe('/admin/dashboard');
  });

  it('should redirect GANADERO from root to /ganadero/dashboard', async () => {
    const { harness, authService, router } = await configure();
    authService.setRole('GANADERO');

    await harness.navigateByUrl('/');

    expect(router.url).toBe('/ganadero/dashboard');
  });

  it('should redirect unauthenticated users from root to /login', async () => {
    const { harness, authService, router } = await configure();
    authService.clear();

    await harness.navigateByUrl('/');

    expect(router.url).toContain('/login');
  });
});
