import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, of, tap } from 'rxjs';
import { ApplicationConfigService } from '../../config/application-config.service';

export type Role = 'ADMIN' | 'GANADERO';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'BLOCKED';

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface BootstrapPayload {
  username: string;
  email: string;
  displayName: string;
  password: string;
}

interface AuthApiUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  version: number;
  updatedAt: string;
  lastSyncedAt: string | null;
}

interface AuthApiResponse {
  accessToken: string;
  tokenType: string;
  expiresInSeconds: number;
  user: AuthApiUser;
}

interface AuthApiError {
  code?: string;
  message?: string;
}

export interface AuthErrorState {
  code: string;
  message: string;
}

export interface AuthActionResult {
  success: boolean;
  error: AuthErrorState | null;
}

export interface SessionUser {
  id: string;
  username: string;
  email: string;
  displayName: string;
  role: Role;
  status: UserStatus;
  version: number;
  updatedAt: string;
  lastSyncedAt: string | null;
}

interface StoredSession {
  token: string;
  user: SessionUser;
}

function getStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null {
  const storage = globalThis.localStorage as Partial<Storage> | undefined;
  if (!storage?.getItem || !storage.setItem || !storage.removeItem) {
    return null;
  }

  return storage as Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: 'Usuario, correo o contraseña inválidos.',
  ACCOUNT_INACTIVE: 'Tu cuenta está inactiva. Contactá a un administrador.',
  ACCOUNT_BLOCKED: 'Tu cuenta está bloqueada. Contactá a un administrador.',
  PASSWORD_POLICY_VIOLATION:
    'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.',
  BOOTSTRAP_ALREADY_COMPLETED:
    'El bootstrap inicial ya fue completado. Iniciá sesión con una cuenta activa.',
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly storageKey = 'hato-session';
  private readonly accessToken = signal<string | null>(null);
  private readonly currentUserState = signal<SessionUser | null>(null);

  readonly loading = signal(false);
  readonly isAuthenticated = computed(
    () => !!this.accessToken() && this.currentUserState()?.status === 'ACTIVE'
  );
  readonly currentUser = this.currentUserState.asReadonly();

  constructor() {
    this.restoreSession();
  }

  login(payload: LoginCredentials) {
    return this.executeAuthRequest<AuthApiResponse>('/auth/login', payload);
  }

  bootstrap(payload: BootstrapPayload) {
    return this.executeAuthRequest<AuthApiResponse>('/admin/bootstrap', payload);
  }

  logout() {
    getStorage()?.removeItem(this.storageKey);
    this.accessToken.set(null);
    this.currentUserState.set(null);
    void this.router.navigate(['/login']);
  }

  hasRole(role: Role) {
    return this.currentUser()?.role === role;
  }

  getAccessToken() {
    return this.accessToken();
  }

  private executeAuthRequest<T extends AuthApiResponse>(path: string, payload: unknown) {
    this.loading.set(true);

    return this.http.post<T>(`${this.appConfig.config().apiBaseUrl}${path}`, payload).pipe(
      tap((response) => this.persistSession(response.accessToken, this.mapSessionUser(response.user))),
      map<AuthApiResponse, AuthActionResult>(() => ({ success: true, error: null })),
      catchError((error: HttpErrorResponse) => of(this.mapError(error))),
      finalize(() => this.loading.set(false))
    );
  }

  private mapSessionUser(user: AuthApiUser): SessionUser {
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: user.status,
      version: user.version,
      updatedAt: user.updatedAt,
      lastSyncedAt: user.lastSyncedAt,
    };
  }

  private mapError(error: HttpErrorResponse): AuthActionResult {
    const apiError = (error.error as AuthApiError | null) ?? {};
    const code = apiError.code ?? 'UNKNOWN_AUTH_ERROR';

    getStorage()?.removeItem(this.storageKey);
    this.accessToken.set(null);
    this.currentUserState.set(null);

    return {
      success: false,
      error: {
        code,
        message: AUTH_ERROR_MESSAGES[code] ?? apiError.message ?? 'No pudimos completar la operación.',
      },
    };
  }

  private restoreSession() {
    const rawSession = getStorage()?.getItem(this.storageKey);
    if (!rawSession) {
      return;
    }

    try {
      const session = JSON.parse(rawSession) as StoredSession;
      this.accessToken.set(session.token);
      this.currentUserState.set(session.user);
    } catch {
      getStorage()?.removeItem(this.storageKey);
    }
  }

  private persistSession(token: string, user: SessionUser) {
    this.accessToken.set(token);
    this.currentUserState.set(user);
    getStorage()?.setItem(this.storageKey, JSON.stringify({ token, user } satisfies StoredSession));
  }
}
