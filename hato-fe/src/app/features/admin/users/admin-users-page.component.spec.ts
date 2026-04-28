import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AdminUsersPageComponent } from './admin-users-page.component';
import { AdminUsersService, type AdminUsersSyncState } from './data-access/admin-users.service';

describe('AdminUsersPageComponent', () => {
  const createServiceMock = () => ({
    listUsers: () => of([]),
    createUser: vi.fn(() => of({ outcome: 'synced', message: 'Usuario guardado correctamente.' })),
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

    const fixture = TestBed.createComponent(AdminUsersPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('should show explicit required messages for the controlled user form', async () => {
    const { fixture, component } = await configure(createServiceMock());

    component.submitCreate();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá un usuario.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá un correo válido.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá un nombre visible.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá una contraseña segura.');
  });

  it('should validate the password policy before creating a managed user', async () => {
    const serviceMock = createServiceMock();
    const { fixture, component } = await configure(serviceMock);

    component.createForm.setValue({
      username: 'gestion-admin',
      email: 'gestion-admin@hato.bo',
      displayName: 'Gestión Admin',
      role: 'ADMIN',
      password: 'weakpass',
    });

    component.submitCreate();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.'
    );
    expect(serviceMock.createUser).not.toHaveBeenCalled();
  });

  it('should require explicit reset password fields before submitting that form', async () => {
    const { fixture, component } = await configure(createServiceMock());

    component.submitPasswordReset();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Seleccioná el usuario a resetear.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá una nueva contraseña segura.');
  });

  it('should validate the password policy before resetting a password', async () => {
    const serviceMock = createServiceMock();
    const { fixture, component } = await configure(serviceMock);

    component.passwordForm.setValue({ userId: 'managed-user', password: 'weakpass' });

    component.submitPasswordReset();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.'
    );
    expect(serviceMock.resetPassword).not.toHaveBeenCalled();
  });

  it('should keep admin submit buttons disabled until each form becomes valid', async () => {
    const { fixture } = await configure(createServiceMock());

    const buttons = Array.from(
      fixture.nativeElement.querySelectorAll('button[type="submit"]')
    ) as HTMLButtonElement[];

    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => button.disabled)).toBe(true);
  });

  it('should show an empty state when there are no managed users yet', async () => {
    const { fixture } = await configure(createServiceMock());

    expect(fixture.nativeElement.textContent).toContain('Todavía no hay usuarios administrados.');
  });

  it('should show a clear error when the administrative user list fails', async () => {
    const { fixture } = await configure({
      ...createServiceMock(),
      listUsers: () => throwError(() => new Error('boom')),
    });

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los usuarios.');
  });

  it('should show sync visibility and manual refresh guidance for admin conflicts', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 1,
      syncing: false,
      lastSyncAt: '2026-04-26T10:05:00.000Z',
      lastMessage: 'Hay un conflicto remoto.',
      manualRefreshRequired: true,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('Estado de sync: 1 pendiente(s)');
    expect(fixture.nativeElement.textContent).toContain('Necesitás refrescar manualmente la lista para resolver el conflicto remoto.');
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
      .mockReturnValueOnce(of([activeUser]))
      .mockReturnValueOnce(of([{ ...activeUser, status: 'INACTIVE', updatedAt: '2026-04-26T10:05:00.000Z' }]));
    serviceMock.updateStatus = vi.fn(() => of({ outcome: 'queued', message: 'Cambio de estado encolado. Se enviará al reconectar.' }));
    const { fixture, component } = await configure(serviceMock);

    component.toggleStatus(activeUser);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Cambio de estado encolado. Se enviará al reconectar.');
    expect(serviceMock.listUsers).toHaveBeenCalledTimes(2);
  });

  it('should show central sync progress and the latest post-sync message for admin users', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 0,
      syncing: true,
      lastSyncAt: '2026-04-26T10:10:00.000Z',
      lastMessage: 'Sincronización central en curso.',
      manualRefreshRequired: false,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('Sincronizando cambios offline…');
    expect(fixture.nativeElement.textContent).toContain('Sincronización central en curso.');
  });

  it('should disable sensitive submit buttons while offline and explain they remain online only', async () => {
    const serviceMock = createServiceMock();
    const { fixture } = await configure(serviceMock, {
      message: 'Modo sin conexión. La shell instalada sigue disponible mientras recuperamos la conectividad.',
    });

    const submitButtons = Array.from(
      fixture.nativeElement.querySelectorAll('button[type="submit"]')
    ) as HTMLButtonElement[];

    expect(submitButtons).toHaveLength(2);
    expect(submitButtons.every((button) => button.disabled)).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Las altas de usuarios y resets de contraseña se resuelven solo online.');
  });
});
