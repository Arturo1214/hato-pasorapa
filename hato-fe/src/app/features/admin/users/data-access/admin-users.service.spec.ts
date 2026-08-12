import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { InMemoryOfflinePersistenceAdapter } from '../../../../core/offline/offline-store.migrations';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { SyncMetricsStore } from '../../../../core/offline/sync-metrics.store';
import { MANUAL_SYNC_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import type { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import { AdminUsersService, type ManagedUser } from './admin-users.service';

describe('AdminUsersService', () => {
  const createManagedUser = (overrides: Partial<ManagedUser> = {}): ManagedUser => ({
    id: 'user-1',
    username: 'gestion-admin',
    email: 'gestion-admin@hato.bo',
    displayName: 'Gestión Admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    version: 1,
    createdAt: '2026-04-26T10:00:00.000Z',
    updatedAt: '2026-04-26T10:00:00.000Z',
    lastSyncedAt: null,
    ...overrides,
  });

  const setup = (options: {
    online: boolean;
    http?: Partial<Pick<HttpClient, 'get' | 'post' | 'put'>>;
    entityChangeBus?: Pick<OfflineEntityChangeBus, 'emit'>;
  }) => {
    let onlineHandler: (() => void | Promise<void>) | undefined;
    vi.spyOn(window, 'addEventListener').mockImplementation((event, listener) => {
      if (event === 'online') {
        onlineHandler = () => {
          if (typeof listener === 'function') {
            return listener(new Event('online'));
          }

          return listener.handleEvent(new Event('online'));
        };
      }
    });

    TestBed.configureTestingModule({
      providers: [
        AdminUsersService,
        SyncMetricsStore,
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            ...options.http,
          },
        },
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: { getAccessToken: () => 'token' },
        },
        {
          provide: OfflineStatusService,
          useValue: { isOnline: () => options.online },
        },
      ],
    });

    const service = TestBed.inject(AdminUsersService);
    const store = new OfflineStoreService(new InMemoryOfflinePersistenceAdapter(), {
      generateId: () => 'operation-user-status-1',
    });
    service.configureForTesting({
      store,
      now: () => '2026-04-26T10:05:00.000Z',
      entityChangeBus: options.entityChangeBus as OfflineEntityChangeBus | undefined,
    });

    return { service, store, fireOnline: async () => await onlineHandler?.() };
  };

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.resetTestingModule();
  });

  it('should read cached user snapshots while offline and preserve the status filter', async () => {
    const { service, store } = setup({ online: false });
    await store.saveSnapshot({
      key: 'USER:user-1',
      entityType: 'USER',
      entityId: 'user-1',
      payload: { ...createManagedUser() },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
    });
    await store.saveSnapshot({
      key: 'USER:user-2',
      entityType: 'USER',
      entityId: 'user-2',
      payload: {
        ...createManagedUser({
          id: 'user-2',
          username: 'ganadero',
          role: 'GANADERO',
          status: 'INACTIVE',
        }),
      },
      updatedAt: '2026-04-26T10:01:00.000Z',
      version: 2,
    });

    await expect(firstValueFrom(service.listUsers('ACTIVE'))).resolves.toEqual([
      createManagedUser(),
    ]);
  });

  it('should block offline user creation instead of persisting passwords locally', async () => {
    const { service, store } = setup({ online: false });

    await expect(
      firstValueFrom(
        service.createUser({
          username: 'nuevo-admin',
          email: 'nuevo-admin@hato.bo',
          displayName: 'Nuevo Admin',
          role: 'ADMIN',
          password: 'Secret123',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'blocked',
      message:
        'La creación de usuarios requiere conexión para no persistir credenciales sensibles sin conexión.',
    });
    await expect(store.listOutbox()).resolves.toEqual([]);
  });

  it('should block offline password resets instead of persisting passwords locally', async () => {
    const { service, store } = setup({ online: false });

    await expect(firstValueFrom(service.resetPassword('user-1', 'Secret123'))).resolves.toEqual({
      outcome: 'blocked',
      message:
        'El restablecimiento de contraseñas requiere conexión para no persistir credenciales sensibles sin conexión.',
    });
    await expect(store.listOutbox()).resolves.toEqual([]);
  });

  it('should emit a USER change when online user creation saves the returned snapshot', async () => {
    const created = createManagedUser({ id: 'user-created', username: 'nuevo-admin' });
    const entityChangeBus = { emit: vi.fn() };
    const { service } = setup({
      online: true,
      http: { post: vi.fn(() => of(created)) as never },
      entityChangeBus,
    });

    await expect(
      firstValueFrom(
        service.createUser({
          username: 'nuevo-admin',
          email: 'nuevo-admin@hato.bo',
          displayName: 'Nuevo Admin',
          role: 'ADMIN',
          password: 'Secret123',
        }),
      ),
    ).resolves.toEqual({ outcome: 'synced', message: 'Usuario guardado correctamente.' });

    expect(entityChangeBus.emit).toHaveBeenCalledWith({
      entity: 'USER',
      source: 'online-mutation',
      operation: 'snapshot-upsert',
      ids: ['user-created'],
    });
  });

  it('should emit a USER change when online user update saves the returned snapshot', async () => {
    const updated = createManagedUser({ displayName: 'Gestión Admin Editado' });
    const entityChangeBus = { emit: vi.fn() };
    const { service } = setup({
      online: true,
      http: { put: vi.fn(() => of(updated)) as never },
      entityChangeBus,
    });

    await expect(
      firstValueFrom(
        service.updateUser('user-1', {
          username: 'gestion-admin',
          email: 'gestion-admin@hato.bo',
          displayName: 'Gestión Admin Editado',
          role: 'ADMIN',
        }),
      ),
    ).resolves.toEqual({ outcome: 'synced', message: 'Usuario actualizado correctamente.' });

    expect(entityChangeBus.emit).toHaveBeenCalledWith({
      entity: 'USER',
      source: 'online-mutation',
      operation: 'snapshot-upsert',
      ids: ['user-1'],
    });
  });

  it('should keep a created user visible when the next online list response is stale', async () => {
    const created = createManagedUser({
      id: 'user-created',
      username: 'nuevo-admin',
      displayName: 'Nuevo Admin',
      updatedAt: '2026-04-26T10:10:00.000Z',
    });
    const { service } = setup({
      online: true,
      http: {
        post: vi.fn(() => of(created)) as never,
        get: vi.fn(() => of({ users: [] })) as never,
      },
      entityChangeBus: { emit: vi.fn() },
    });

    await firstValueFrom(
      service.createUser({
        username: 'nuevo-admin',
        email: 'nuevo-admin@hato.bo',
        displayName: 'Nuevo Admin',
        role: 'ADMIN',
        password: 'Secret123',
      }),
    );

    await expect(firstValueFrom(service.listUsers())).resolves.toEqual([created]);
  });

  it('should prefer a recently updated user snapshot over a stale online list row', async () => {
    const stale = createManagedUser({ displayName: 'Gestión Admin' });
    const updated = createManagedUser({
      displayName: 'Gestión Admin Editado',
      updatedAt: '2026-04-26T10:10:00.000Z',
    });
    const { service } = setup({
      online: true,
      http: {
        put: vi.fn(() => of(updated)) as never,
        get: vi.fn(() => of({ users: [stale] })) as never,
      },
      entityChangeBus: { emit: vi.fn() },
    });

    await firstValueFrom(
      service.updateUser('user-1', {
        username: 'gestion-admin',
        email: 'gestion-admin@hato.bo',
        displayName: 'Gestión Admin Editado',
        role: 'ADMIN',
      }),
    );

    await expect(firstValueFrom(service.listUsers())).resolves.toEqual([updated]);
  });

  it('should enqueue user status changes online and delegate replay to the global sync orchestrator', async () => {
    const dispatchEvent = vi.spyOn(window, 'dispatchEvent');
    const put = vi.fn();
    const entityChangeBus = { emit: vi.fn() };
    const { service, store } = setup({
      online: true,
      http: { put: put as never },
      entityChangeBus,
    });
    await store.saveSnapshot({
      key: 'USER:user-1',
      entityType: 'USER',
      entityId: 'user-1',
      payload: { ...createManagedUser() },
      updatedAt: '2026-04-26T10:00:00.000Z',
      version: 1,
    });

    await expect(firstValueFrom(service.updateStatus('user-1', 'INACTIVE'))).resolves.toEqual({
      outcome: 'queued',
      message: 'Cambio de estado encolado. Se disparó la sincronización automática.',
    });
    await expect(firstValueFrom(service.listUsers())).resolves.toEqual([
      createManagedUser({ status: 'INACTIVE', version: 1, updatedAt: '2026-04-26T10:05:00.000Z' }),
    ]);

    expect(dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: MANUAL_SYNC_EVENT }),
    );
    expect(put).not.toHaveBeenCalled();
    expect(service.syncState().pending).toBe(1);
    expect(entityChangeBus.emit).toHaveBeenCalledWith({
      entity: 'USER',
      source: 'local-mutation',
      operation: 'status-update',
      ids: ['user-1'],
    });
  });
});
