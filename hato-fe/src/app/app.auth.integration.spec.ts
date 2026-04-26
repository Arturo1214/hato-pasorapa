import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { routes } from './app.routes';
import { ApplicationConfigService } from './core/config/application-config.service';
import {
  AuthService,
  type AuthActionResult,
  type BootstrapPayload,
  type LoginCredentials,
  type SessionUser,
} from './core/auth/data-access/auth.service';
import { AdminDashboardService } from './features/admin/dashboard/data-access/admin-dashboard.service';
import { AdminUsersService } from './features/admin/users/data-access/admin-users.service';
import { GanaderosService } from './features/admin/ganaderos/data-access/ganaderos.service';

class AuthServiceStub {
  readonly loading = signal(false);
  private readonly currentUserState = signal<SessionUser | null>(null);
  private readonly accessToken = signal<string | null>(null);

  readonly isAuthenticated = computed(
    () => !!this.accessToken() && this.currentUserState()?.status === 'ACTIVE'
  );
  readonly currentUser = this.currentUserState.asReadonly();

  login(payload: LoginCredentials) {
    this.persistSession(payload.username === 'admin' ? 'ADMIN' : 'GANADERO');
    return of<AuthActionResult>({ success: true, error: null });
  }

  bootstrap(_payload: BootstrapPayload) {
    this.persistSession('ADMIN');
    return of<AuthActionResult>({ success: true, error: null });
  }

  logout() {
    this.accessToken.set(null);
    this.currentUserState.set(null);
  }

  hasRole(role: 'ADMIN' | 'GANADERO') {
    return this.currentUser()?.role === role;
  }

  getAccessToken() {
    return this.accessToken();
  }

  setGuest() {
    this.accessToken.set(null);
    this.currentUserState.set(null);
  }

  private persistSession(role: 'ADMIN' | 'GANADERO') {
    this.accessToken.set('token-value');
    this.currentUserState.set({
      id: 'user-id',
      username: role === 'ADMIN' ? 'admin' : 'ganadero',
      email: role === 'ADMIN' ? 'admin@hato.bo' : 'ganadero@hato.bo',
      displayName: role === 'ADMIN' ? 'Admin Root' : 'Ganadero Base',
      role,
      status: 'ACTIVE',
      version: 1,
      updatedAt: '2026-04-25T00:00:00Z',
      lastSyncedAt: null,
    });
  }
}

describe('admin auth integration flow', () => {
  const configure = async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });

    const authService = new AuthServiceStub();

    await TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter(routes),
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        { provide: AuthService, useValue: authService },
        {
          provide: AdminDashboardService,
          useValue: {
            loadMetrics: () =>
              of({
                admins: { total: 1, active: 1, inactive: 0, blocked: 0 },
                ganaderos: { total: 0, active: 0, inactive: 0, blocked: 0 },
              }),
          },
        },
        { provide: AdminUsersService, useValue: { listUsers: () => of([]) } },
        { provide: GanaderosService, useValue: { listGanaderos: () => of([]) } },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create('/');
    return { harness, authService, router: TestBed.inject(Router) };
  };

  it('should redirect guests to login before protected admin routes and allow access after login', async () => {
    const { harness, router } = await configure();

    await harness.navigateByUrl('/admin/dashboard');
    expect(router.url).toBe('/login');

    const usernameInput = harness.routeNativeElement?.querySelector(
      'input[formcontrolname="username"]'
    ) as HTMLInputElement;
    const passwordInput = harness.routeNativeElement?.querySelector(
      'input[formcontrolname="password"]'
    ) as HTMLInputElement;
    const form = harness.routeNativeElement?.querySelector('form') as HTMLFormElement;

    usernameInput.value = 'admin';
    usernameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'Admin123';
    passwordInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/');

    await harness.navigateByUrl('/admin/dashboard');
    expect(router.url).toBe('/admin/dashboard');
    expect(harness.routeNativeElement?.textContent).toContain('Dashboard');
  });

  it('should allow bootstrap for guests and expose admin navigation after the initial setup', async () => {
    const { harness, authService, router } = await configure();

    authService.setGuest();
    await harness.navigateByUrl('/admin/bootstrap');

    const usernameInput = harness.routeNativeElement?.querySelector(
      'input[formcontrolname="username"]'
    ) as HTMLInputElement;
    const emailInput = harness.routeNativeElement?.querySelector(
      'input[formcontrolname="email"]'
    ) as HTMLInputElement;
    const displayNameInput = harness.routeNativeElement?.querySelector(
      'input[formcontrolname="displayName"]'
    ) as HTMLInputElement;
    const passwordInput = harness.routeNativeElement?.querySelector(
      'input[formcontrolname="password"]'
    ) as HTMLInputElement;
    const form = harness.routeNativeElement?.querySelector('form') as HTMLFormElement;

    usernameInput.value = 'root-admin';
    usernameInput.dispatchEvent(new Event('input'));
    emailInput.value = 'root-admin@hato.bo';
    emailInput.dispatchEvent(new Event('input'));
    displayNameInput.value = 'Root Admin';
    displayNameInput.dispatchEvent(new Event('input'));
    passwordInput.value = 'RootAdmin9';
    passwordInput.dispatchEvent(new Event('input'));
    form.dispatchEvent(new Event('submit'));
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(router.url).toBe('/');
    expect(harness.routeNativeElement?.textContent).toContain('Dashboard');
    expect(harness.routeNativeElement?.textContent).toContain('Usuarios');
    expect(harness.routeNativeElement?.textContent).toContain('Ganaderos');
  });
});
