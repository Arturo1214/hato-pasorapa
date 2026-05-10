import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AdminUsersPageComponent } from './admin-users-page.component';
import { AdminUsersService, type AdminUsersSyncState, type ManagedUser } from './data-access/admin-users.service';

describe('AdminUsersPageComponent', () => {
  let overlayContainer: OverlayContainer;

  const createServiceMock = () => ({
    listUsers: vi.fn(() => of([] as ManagedUser[])),
    createUser: vi.fn(() => of({ outcome: 'synced', message: 'Usuario guardado correctamente.' })),
    updateUser: vi.fn(() => of({ outcome: 'synced', message: 'Usuario actualizado correctamente.' })),
    updateStatus: vi.fn(() => of({ outcome: 'synced', message: 'Usuario dado de baja correctamente.' })),
    resetPassword: vi.fn(() => of({ outcome: 'synced', message: 'Contraseña reseteada correctamente.' })),
    syncState: signal<AdminUsersSyncState>({
      pending: 0,
      syncing: false,
      lastSyncAt: null,
      lastMessage: null,
      manualRefreshRequired: false,
    }),
  });

  const configure = async (
    serviceMock: ReturnType<typeof createServiceMock>,
    offline: { message?: string | null } = {}
  ) => {
    await TestBed.configureTestingModule({
      imports: [AdminUsersPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: AdminUsersService,
          useValue: serviceMock,
        },
        {
          provide: OfflineStatusService,
          useValue: {
            message: signal(offline.message ?? null),
          },
        },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    const fixture = TestBed.createComponent(AdminUsersPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('should show an empty state when there are no managed users yet', async () => {
    const { fixture } = await configure(createServiceMock());

    expect(fixture.nativeElement.textContent).toContain('Todavía no hay usuarios administrados.');
  });

  it('should show a clear error when the administrative user list fails', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listUsers.mockReturnValue(throwError(() => new Error('boom')));
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los usuarios.');
  });

  it('should not show offline sync state in the admin users list', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 1,
      syncing: false,
      lastSyncAt: '2026-04-26T10:05:00.000Z',
      lastMessage: 'Hay un conflicto remoto.',
      manualRefreshRequired: true,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).not.toContain('Estado de sync');
    expect(fixture.nativeElement.textContent).not.toContain('Última sync');
    expect(fixture.nativeElement.textContent).not.toContain('Necesitás refrescar manualmente la lista para resolver el conflicto remoto.');
  });

  it('should show queued feedback when a user status change stays offline first', async () => {
    const activeUser = {
      id: 'user-1',
      username: 'gestion-admin',
      email: 'gestion-admin@hato.bo',
      displayName: 'Gestión Admin',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      version: 1,
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      lastSyncedAt: null,
    };
    const serviceMock = createServiceMock();
    serviceMock.listUsers = vi
      .fn()
      .mockReturnValueOnce(of([activeUser] as ManagedUser[]))
      .mockReturnValueOnce(of([{ ...activeUser, status: 'INACTIVE', updatedAt: '2026-04-26T10:05:00.000Z' }] as ManagedUser[]));
    serviceMock.updateStatus = vi.fn(() => of({ outcome: 'queued', message: 'Cambio de estado encolado. Se enviará al reconectar.' }));
    const { fixture, component } = await configure(serviceMock);

    component.handleRowAction({ actionId: 'toggle-status', row: activeUser });
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Deshabilitar')
    ) as HTMLButtonElement;
    confirmButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cambio de estado encolado. Se enviará al reconectar.');
    expect(serviceMock.listUsers).toHaveBeenCalledTimes(2);
  });

  it('should filter the table by role when the parent updates the active filters', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listUsers.mockReturnValue(
      of([
        {
          id: 'user-1',
          username: 'gestion-admin',
          email: 'gestion-admin@hato.bo',
          displayName: 'Gestión Admin',
          role: 'ADMIN' as const,
          status: 'ACTIVE' as const,
          version: 1,
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
          lastSyncedAt: null,
        },
        {
          id: 'user-2',
          username: 'campo-sur',
          email: 'campo-sur@hato.bo',
          displayName: 'Campo Sur',
          role: 'GANADERO' as const,
          status: 'ACTIVE' as const,
          version: 1,
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
          lastSyncedAt: null,
        },
      ])
    );
    const { fixture, component } = await configure(serviceMock);

    component.filters.set({ role: 'GANADERO' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('campo-sur');
    expect(fixture.nativeElement.textContent).not.toContain('Gestión Admin');
  });

  it('should open the create modal from the toolbar action', async () => {
    const { fixture } = await configure(createServiceMock());

    const createButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((button) =>
      button.textContent?.includes('Crear usuario')
    ) as HTMLButtonElement;
    createButton.click();
    fixture.detectChanges();

    expect(overlayContainer.getContainerElement().textContent).toContain('Crear usuario');
  });

  it('should disable a managed user after confirmation from the row action', async () => {
    const managedUser = {
      id: 'user-1',
      username: 'gestion-admin',
      email: 'gestion-admin@hato.bo',
      displayName: 'Gestión Admin',
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      version: 1,
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      lastSyncedAt: null,
    };
    const serviceMock = createServiceMock();
    serviceMock.listUsers = vi.fn(() => of([managedUser] as ManagedUser[]));
    const { fixture, component } = await configure(serviceMock);

    component.handleRowAction({ actionId: 'toggle-status', row: managedUser });
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Deshabilitar')
    ) as HTMLButtonElement;
    confirmButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.updateStatus).toHaveBeenCalledWith('user-1', 'INACTIVE');
  });

  it('should not show offline sync progress in the admin users list', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 0,
      syncing: true,
      lastSyncAt: '2026-04-26T10:10:00.000Z',
      lastMessage: 'Sincronización central en curso.',
      manualRefreshRequired: false,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).not.toContain('Sincronizando cambios offline…');
    expect(fixture.nativeElement.textContent).not.toContain('Sincronización central en curso.');
  });

  it('should disable sensitive submit buttons while offline and explain they remain online only', async () => {
    const serviceMock = createServiceMock();
    const { fixture } = await configure(serviceMock, {
      message: 'Modo sin conexión. La shell instalada sigue disponible mientras recuperamos la conectividad.',
    });

    const createButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((button) =>
      button.textContent?.includes('Crear usuario')
    ) as HTMLButtonElement;

    expect(createButton.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Las altas, ediciones y resets de contraseñas de usuarios se resuelven solo online.');
  });
});
