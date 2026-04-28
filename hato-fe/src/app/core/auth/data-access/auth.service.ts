import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, concatMap, finalize, from, map, of } from 'rxjs';
import { ApplicationConfigService } from '../../config/application-config.service';
import { DEFAULT_OFFLINE_STORE_SERVICE } from '../../offline/offline-store.service';

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

export type OfflineSessionStatus = 'active' | 'reauth_required' | 'expired';
export type OfflineSessionBoundaryReason =
  | 'ttl_elapsed'
  | 'logout'
  | 'user_switch'
  | 'manual_lock'
  | 'migration_reauth_required';
export type OfflineSessionCleanupPolicy = 'soft_retention' | 'shared_device_hard';

export interface OfflineSessionEnvelope {
  userId: string;
  status: OfflineSessionStatus;
  issuedAt: string;
  lastAuthAt: string;
  lastValidatedAt: string;
  expiresAt: string;
  reason?: OfflineSessionBoundaryReason;
}

interface BuildOfflineSessionEnvelopeInput {
  userId: string;
  issuedAt: string;
  expiresInSeconds: number;
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

const DEFAULT_SESSION_TTL_SECONDS = 8 * 60 * 60;

export function buildOfflineSessionEnvelope(input: BuildOfflineSessionEnvelopeInput): OfflineSessionEnvelope {
  const expiresAt = new Date(Date.parse(input.issuedAt) + input.expiresInSeconds * 1000).toISOString();

  return {
    userId: input.userId,
    status: 'active',
    issuedAt: input.issuedAt,
    lastAuthAt: input.issuedAt,
    lastValidatedAt: input.issuedAt,
    expiresAt,
  };
}

export function lockOfflineSessionEnvelope(
  envelope: OfflineSessionEnvelope,
  reason: Extract<OfflineSessionBoundaryReason, 'logout' | 'user_switch' | 'manual_lock' | 'migration_reauth_required'>,
  now: string
): OfflineSessionEnvelope {
  return {
    ...envelope,
    status: 'reauth_required',
    reason,
    lastValidatedAt: now,
  };
}

export function evaluateOfflineSession(envelope: OfflineSessionEnvelope | null, now: string): OfflineSessionEnvelope | null {
  if (!envelope) {
    return null;
  }

  if (Date.parse(now) >= Date.parse(envelope.expiresAt)) {
    return {
      ...envelope,
      status: 'expired',
      reason: 'ttl_elapsed',
      lastValidatedAt: now,
    };
  }

  if (envelope.status === 'reauth_required') {
    return {
      ...envelope,
      lastValidatedAt: now,
    };
  }

  return {
    ...envelope,
    status: 'active',
    reason: undefined,
    lastValidatedAt: now,
  };
}

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly offlineStore = DEFAULT_OFFLINE_STORE_SERVICE;
  private readonly storageKey = 'hato-session';
  private readonly sessionEnvelopeStorageKey = 'hato-session-envelope';
  private readonly accessToken = signal<string | null>(null);
  private readonly currentUserState = signal<SessionUser | null>(null);
  private readonly offlineSessionState = signal<OfflineSessionEnvelope | null>(null);

  readonly loading = signal(false);
  readonly isAuthenticated = computed(
    () =>
      !!this.accessToken() &&
      this.currentUserState()?.status === 'ACTIVE' &&
      this.offlineSessionState()?.status === 'active'
  );
  readonly currentUser = this.currentUserState.asReadonly();
  readonly offlineSession = this.offlineSessionState.asReadonly();

  constructor() {
    this.restoreSession();
  }

  login(payload: LoginCredentials) {
    return this.executeAuthRequest<AuthApiResponse>('/auth/login', payload);
  }

  bootstrap(payload: BootstrapPayload) {
    return this.executeAuthRequest<AuthApiResponse>('/admin/bootstrap', payload);
  }

  logout(reason: Extract<OfflineSessionBoundaryReason, 'logout' | 'manual_lock'> = 'logout') {
    void this.offlineStore.clearForSessionBoundary('shared_device_hard', reason);
    const storage = getStorage();
    storage?.removeItem(this.storageKey);
    storage?.removeItem(this.sessionEnvelopeStorageKey);
    this.accessToken.set(null);
    this.currentUserState.set(null);
    this.offlineSessionState.set(null);
    void this.router.navigate(['/login']);
  }

  hasRole(role: Role) {
    return this.currentUser()?.role === role;
  }

  getAccessToken() {
    return this.accessToken();
  }

  getOfflineSessionStatus(now = new Date().toISOString()) {
    return this.refreshOfflineSession(now);
  }

  async forceReauthAfterRestore(now = new Date().toISOString()) {
    const currentEnvelope = this.offlineSessionState();

    if (currentEnvelope) {
      this.setOfflineSessionState(lockOfflineSessionEnvelope(currentEnvelope, 'manual_lock', now), true);
      return;
    }

    const currentUser = this.currentUserState();
    if (!currentUser) {
      return;
    }

    this.setOfflineSessionState(
      lockOfflineSessionEnvelope(
        buildOfflineSessionEnvelope({
          userId: currentUser.id,
          issuedAt: now,
          expiresInSeconds: DEFAULT_SESSION_TTL_SECONDS,
        }),
        'manual_lock',
        now
      ),
      true
    );
  }

  refreshOfflineSession(now = new Date().toISOString()) {
    const currentEnvelope = this.offlineSessionState();
    const nextEnvelope = evaluateOfflineSession(currentEnvelope, now);

    if (!nextEnvelope) {
      return 'reauth_required' satisfies OfflineSessionStatus;
    }

    if (
      currentEnvelope?.status === 'active' &&
      nextEnvelope.status === 'expired' &&
      nextEnvelope.reason === 'ttl_elapsed'
    ) {
      void this.offlineStore.clearForSessionBoundary('soft_retention', 'ttl_elapsed');
    }

    this.setOfflineSessionState(nextEnvelope, true);
    return nextEnvelope.status;
  }

  private executeAuthRequest<T extends AuthApiResponse>(path: string, payload: unknown) {
    this.loading.set(true);

    return this.http.post<T>(`${this.appConfig.config().apiBaseUrl}${path}`, payload).pipe(
      concatMap((response) =>
        from(this.persistSession(response.accessToken, this.mapSessionUser(response.user), response.expiresInSeconds)).pipe(
          map((): AuthActionResult => ({ success: true, error: null }))
        )
      ),
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

    const storage = getStorage();
    storage?.removeItem(this.storageKey);
    storage?.removeItem(this.sessionEnvelopeStorageKey);
    this.accessToken.set(null);
    this.currentUserState.set(null);
    this.offlineSessionState.set(null);

    return {
      success: false,
      error: {
        code,
        message: AUTH_ERROR_MESSAGES[code] ?? apiError.message ?? 'No pudimos completar la operación.',
      },
    };
  }

  private restoreSession() {
    const storage = getStorage();
    const rawSession = storage?.getItem(this.storageKey);
    if (!rawSession) {
      storage?.removeItem(this.sessionEnvelopeStorageKey);
      return;
    }

    try {
      const session = JSON.parse(rawSession) as StoredSession;
      this.accessToken.set(session.token);
      this.currentUserState.set(session.user);

      const now = new Date().toISOString();
      const rawEnvelope = storage?.getItem(this.sessionEnvelopeStorageKey);
      const parsedEnvelope = rawEnvelope ? (JSON.parse(rawEnvelope) as OfflineSessionEnvelope) : null;
      const baseEnvelope =
        parsedEnvelope && parsedEnvelope.userId === session.user.id
          ? parsedEnvelope
          : lockOfflineSessionEnvelope(
              buildOfflineSessionEnvelope({
                userId: session.user.id,
                issuedAt: now,
                expiresInSeconds: DEFAULT_SESSION_TTL_SECONDS,
              }),
              'migration_reauth_required',
              now
            );

      this.setOfflineSessionState(evaluateOfflineSession(baseEnvelope, now), true);
    } catch {
      storage?.removeItem(this.storageKey);
      storage?.removeItem(this.sessionEnvelopeStorageKey);
    }
  }

  private async persistSession(token: string, user: SessionUser, expiresInSeconds: number) {
    const previousUserId = this.currentUserState()?.id ?? this.offlineSessionState()?.userId ?? null;
    if (previousUserId && previousUserId !== user.id) {
      await this.offlineStore.clearForSessionBoundary('shared_device_hard', 'user_switch');
    }

    const issuedAt = new Date().toISOString();
    this.accessToken.set(token);
    this.currentUserState.set(user);
    this.setOfflineSessionState(
      buildOfflineSessionEnvelope({
        userId: user.id,
        issuedAt,
        expiresInSeconds,
      }),
      false
    );

    const storage = getStorage();
    storage?.setItem(this.storageKey, JSON.stringify({ token, user } satisfies StoredSession));
    storage?.setItem(this.sessionEnvelopeStorageKey, JSON.stringify(this.offlineSessionState()));
  }

  private setOfflineSessionState(envelope: OfflineSessionEnvelope | null, persist: boolean) {
    this.offlineSessionState.set(envelope);

    if (!persist) {
      return;
    }

    const storage = getStorage();
    if (!storage) {
      return;
    }

    if (envelope) {
      storage.setItem(this.sessionEnvelopeStorageKey, JSON.stringify(envelope));
      return;
    }

    storage.removeItem(this.sessionEnvelopeStorageKey);
  }
}
