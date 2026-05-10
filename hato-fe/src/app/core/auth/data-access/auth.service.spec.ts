import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationConfigService } from '../../config/application-config.service';
import { DEFAULT_OFFLINE_STORE_SERVICE } from '../../offline/offline-store.service';
import {
  AuthService,
  buildOfflineSessionEnvelope,
  evaluateOfflineSession,
  lockOfflineSessionEnvelope,
  type LoginCredentials,
  type SessionUser,
} from './auth.service';

@Component({
  standalone: true,
  template: '',
})
class DummyLoginComponent {}

describe('AuthService', () => {
  let service: AuthService;
  let httpController: HttpTestingController;

  const installStorageMock = () => {
    let store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = value;
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      },
    });
  };

  beforeEach(() => {
    installStorageMock();
    globalThis.localStorage.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-28T12:00:00.000Z'));

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: 'login', component: DummyLoginComponent }]),
        AuthService,
        {
          provide: ApplicationConfigService,
          useValue: {
            config: () => ({ apiBaseUrl: '/api' }),
          },
        },
      ],
    });

    service = TestBed.inject(AuthService);
    httpController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpController.verify();
    globalThis.localStorage.clear();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should persist a valid session with ADMIN role and account status', async () => {
    const credentials: LoginCredentials = { username: 'admin', password: 'Admin123' };

    const resultPromise = firstValueFrom(service.login(credentials));
    const request = httpController.expectOne('/api/auth/login');

    expect(request.request.method).toBe('POST');
    request.flush({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@hato.bo',
        displayName: 'Admin Root',
        role: 'ADMIN',
        status: 'ACTIVE',
        version: 3,
        updatedAt: '2026-04-25T12:00:00',
        lastSyncedAt: '2026-04-25T12:05:00',
      },
    });

    await expect(resultPromise).resolves.toEqual({ success: true, error: null });
    expect(service.isAuthenticated()).toBe(true);
    expect(service.currentUser()).toEqual<SessionUser>({
      id: 'user-1',
      ganaderoId: null,
      username: 'admin',
      email: 'admin@hato.bo',
      displayName: 'Admin Root',
      role: 'ADMIN',
      status: 'ACTIVE',
      version: 3,
      updatedAt: '2026-04-25T12:00:00',
      lastSyncedAt: '2026-04-25T12:05:00',
    });
    expect(service.getAccessToken()).toBe('jwt-token');
    expect(service.getOfflineSessionStatus('2026-04-28T19:59:59.000Z')).toBe('active');
    expect(JSON.parse(globalThis.localStorage.getItem('hato-session-envelope') ?? '{}')).toMatchObject({
      userId: 'user-1',
      status: 'active',
      lastAuthAt: '2026-04-28T12:00:00.000Z',
      expiresAt: '2026-04-28T20:00:00.000Z',
    });
  });

  it('should accept a ganadero login that uses CI in the same identifier field', async () => {
    const credentials: LoginCredentials = { username: '12345678', password: 'Ganadera9' };

    const resultPromise = firstValueFrom(service.login(credentials));
    const request = httpController.expectOne('/api/auth/login');

    expect(request.request.body).toEqual(credentials);
    request.flush({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-2',
        ganaderoId: 'ganadero-uuid-2',
        username: 'ganadera@hato.bo',
        email: 'ganadera@hato.bo',
        displayName: 'Ganadera Norte',
        role: 'GANADERO',
        status: 'ACTIVE',
        version: 1,
        updatedAt: '2026-04-25T12:10:00',
        lastSyncedAt: null,
      },
    });

    await expect(resultPromise).resolves.toEqual({ success: true, error: null });
    expect(service.currentUser()?.username).toBe('ganadera@hato.bo');
    expect(service.currentUser()?.ganaderoId).toBe('ganadero-uuid-2');
  });

  it('should classify the persisted envelope as expired once the 8h ttl elapses', () => {
    const envelope = buildOfflineSessionEnvelope({
      userId: 'user-1',
      issuedAt: '2026-04-28T12:00:00.000Z',
      expiresInSeconds: 28800,
    });

    expect(evaluateOfflineSession(envelope, '2026-04-28T19:59:59.000Z')?.status).toBe('active');
    expect(evaluateOfflineSession(envelope, '2026-04-28T20:00:00.000Z')).toEqual(
      expect.objectContaining({
        status: 'expired',
        reason: 'ttl_elapsed',
      })
    );
  });

  it('should transition the envelope to reauth_required when a shared-device boundary is locked', () => {
    const envelope = buildOfflineSessionEnvelope({
      userId: 'user-2',
      issuedAt: '2026-04-28T12:00:00.000Z',
      expiresInSeconds: 28800,
    });

    expect(lockOfflineSessionEnvelope(envelope, 'logout', '2026-04-28T12:15:00.000Z')).toEqual(
      expect.objectContaining({
        status: 'reauth_required',
        reason: 'logout',
      })
    );
    expect(lockOfflineSessionEnvelope(envelope, 'user_switch', '2026-04-28T12:16:00.000Z')).toEqual(
      expect.objectContaining({
        status: 'reauth_required',
        reason: 'user_switch',
      })
    );
  });

  it('should trigger shared-device cleanup on logout and remove reusable local session state', async () => {
    const clearBoundarySpy = vi
      .spyOn(DEFAULT_OFFLINE_STORE_SERVICE, 'clearForSessionBoundary')
      .mockResolvedValue({ policy: 'shared_device_hard', outbox: 0, inbox: 0, snapshots: 0 });

    const resultPromise = firstValueFrom(service.login({ username: 'admin', password: 'Admin123' }));
    const request = httpController.expectOne('/api/auth/login');

    request.flush({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@hato.bo',
        displayName: 'Admin Root',
        role: 'ADMIN',
        status: 'ACTIVE',
        version: 3,
        updatedAt: '2026-04-25T12:00:00',
        lastSyncedAt: '2026-04-25T12:05:00',
      },
    });

    await resultPromise;

    service.logout();

    expect(clearBoundarySpy).toHaveBeenCalledWith('shared_device_hard', 'logout');
    expect(service.getAccessToken()).toBeNull();
    expect(globalThis.localStorage.getItem('hato-session')).toBeNull();
    expect(globalThis.localStorage.getItem('hato-session-envelope')).toBeNull();
  });

  it('should purge prior reusable session artifacts before persisting a different user on shared device', async () => {
    const clearBoundarySpy = vi
      .spyOn(DEFAULT_OFFLINE_STORE_SERVICE, 'clearForSessionBoundary')
      .mockResolvedValue({ policy: 'shared_device_hard', outbox: 0, inbox: 0, snapshots: 0 });

    const firstLogin = firstValueFrom(service.login({ username: 'admin', password: 'Admin123' }));
    const firstRequest = httpController.expectOne('/api/auth/login');
    firstRequest.flush({
      accessToken: 'jwt-admin',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@hato.bo',
        displayName: 'Admin Root',
        role: 'ADMIN',
        status: 'ACTIVE',
        version: 3,
        updatedAt: '2026-04-25T12:00:00',
        lastSyncedAt: '2026-04-25T12:05:00',
      },
    });
    await firstLogin;

    const secondLogin = firstValueFrom(service.login({ username: 'operador', password: 'Admin123' }));
    const secondRequest = httpController.expectOne('/api/auth/login');
    secondRequest.flush({
      accessToken: 'jwt-operator',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-2',
        username: 'operador',
        email: 'operador@hato.bo',
        displayName: 'Operador Campo',
        role: 'GANADERO',
        status: 'ACTIVE',
        version: 1,
        updatedAt: '2026-04-25T12:10:00',
        lastSyncedAt: null,
      },
    });
    await secondLogin;

    expect(clearBoundarySpy).toHaveBeenCalledTimes(1);
    expect(clearBoundarySpy).toHaveBeenCalledWith('shared_device_hard', 'user_switch');
    expect(service.currentUser()?.id).toBe('user-2');
    expect(service.getOfflineSessionStatus('2026-04-28T12:30:00.000Z')).toBe('active');
  });

  it('should restore a mismatched persisted envelope as reauth_required so a prior session cannot sync', () => {
    globalThis.localStorage.setItem(
      'hato-session',
      JSON.stringify({
        token: 'jwt-token',
        user: {
          id: 'user-2',
          username: 'operador',
          email: 'operador@hato.bo',
          displayName: 'Operador Campo',
          role: 'GANADERO',
          status: 'ACTIVE',
          version: 1,
          updatedAt: '2026-04-25T12:10:00',
          lastSyncedAt: null,
        },
      })
    );
    globalThis.localStorage.setItem(
      'hato-session-envelope',
      JSON.stringify({
        userId: 'user-1',
        status: 'active',
        issuedAt: '2026-04-28T10:00:00.000Z',
        lastAuthAt: '2026-04-28T10:00:00.000Z',
        lastValidatedAt: '2026-04-28T10:00:00.000Z',
        expiresAt: '2026-04-28T18:00:00.000Z',
      })
    );

    const restoredService = TestBed.runInInjectionContext(() => new AuthService());

    expect(restoredService.getAccessToken()).toBe('jwt-token');
    expect(restoredService.getOfflineSessionStatus('2026-04-28T12:00:00.000Z')).toBe('reauth_required');
    expect(restoredService.offlineSession()).toEqual(
      expect.objectContaining({
        userId: 'user-2',
        status: 'reauth_required',
        reason: 'migration_reauth_required',
      })
    );
    expect(restoredService.isAuthenticated()).toBe(false);
    expect(restoredService.currentUser()?.ganaderoId).toBeNull();
  });

  it('should force reauth_required after a successful local restore so sync stays blocked until login', async () => {
    const resultPromise = firstValueFrom(service.login({ username: 'admin', password: 'Admin123' }));
    const request = httpController.expectOne('/api/auth/login');

    request.flush({
      accessToken: 'jwt-token',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-1',
        username: 'admin',
        email: 'admin@hato.bo',
        displayName: 'Admin Root',
        role: 'ADMIN',
        status: 'ACTIVE',
        version: 3,
        updatedAt: '2026-04-25T12:00:00',
        lastSyncedAt: '2026-04-25T12:05:00',
      },
    });

    await resultPromise;
    await service.forceReauthAfterRestore('2026-04-28T12:30:00.000Z');

    expect(service.getOfflineSessionStatus('2026-04-28T12:30:00.000Z')).toBe('reauth_required');
    expect(service.offlineSession()).toEqual(
      expect.objectContaining({
        status: 'reauth_required',
        reason: 'manual_lock',
      })
    );
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should expose clear backend error messages when login fails', async () => {
    const resultPromise = firstValueFrom(service.login({ username: 'admin', password: 'wrong' }));
    const request = httpController.expectOne('/api/auth/login');

    request.flush(
      { code: 'INVALID_CREDENTIALS', message: 'Las credenciales son inválidas.' },
      { status: 401, statusText: 'Unauthorized' }
    );

    await expect(resultPromise).resolves.toEqual({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Usuario, correo o contraseña inválidos.',
      },
    });
    expect(service.isAuthenticated()).toBe(false);
  });

  it('should fall back to a safe auth message when the backend returns a legacy 500 envelope', async () => {
    const resultPromise = firstValueFrom(service.login({ username: 'admin', password: 'wrong' }));
    const request = httpController.expectOne('/api/auth/login');

    request.flush(
      { details: 'Error id 123', stack: '' },
      { status: 500, statusText: 'Internal Server Error' }
    );

    await expect(resultPromise).resolves.toEqual({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No pudimos completar la operación en este momento. Reintentá en unos minutos.',
      },
    });
  });

  it('should call bootstrap endpoint and keep ADMIN session ready', async () => {
    const resultPromise = firstValueFrom(
      service.bootstrap({
        username: 'root-admin',
        email: 'root-admin@hato.bo',
        displayName: 'Root Admin',
        password: 'RootAdmin9',
      })
    );

    const request = httpController.expectOne('/api/admin/bootstrap');
    expect(request.request.method).toBe('POST');

    request.flush({
      accessToken: 'bootstrap-token',
      tokenType: 'Bearer',
      expiresInSeconds: 28800,
      user: {
        id: 'user-2',
        username: 'root-admin',
        email: 'root-admin@hato.bo',
        displayName: 'Root Admin',
        role: 'ADMIN',
        status: 'ACTIVE',
        version: 0,
        updatedAt: '2026-04-25T15:00:00',
        lastSyncedAt: null,
      },
    });

    await expect(resultPromise).resolves.toEqual({ success: true, error: null });
    expect(service.currentUser()?.role).toBe('ADMIN');
  });
});
