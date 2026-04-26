import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { ApplicationConfigService } from '../../config/application-config.service';
import { AuthService, type LoginCredentials, type SessionUser } from './auth.service';

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

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
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
