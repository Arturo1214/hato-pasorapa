import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { GanaderosPageComponent } from './ganaderos-page.component';
import { GanaderosService, type GanaderoItem, type GanaderosSyncState } from './data-access/ganaderos.service';

describe('GanaderosPageComponent', () => {
  let overlayContainer: OverlayContainer;

  const createServiceMock = () => ({
    listGanaderos: vi.fn(() => of([] as GanaderoItem[])),
    createGanadero: vi.fn(() => of({ outcome: 'synced', message: 'Ganadero registrado correctamente.' })),
    updateGanadero: vi.fn(() => of({ outcome: 'synced', message: 'Ganadero actualizado correctamente.' })),
    resetPassword: vi.fn(() => of({ outcome: 'synced', message: 'Contraseña temporal reseteada correctamente.' })),
    updateStatus: vi.fn(() => of({ outcome: 'synced', message: 'Ganadero dado de baja correctamente.' })),
    syncState: signal<GanaderosSyncState>({
      pending: 0,
      syncing: false,
      lastSyncAt: null,
      lastMessage: null,
      manualRefreshRequired: false,
    }),
  });

  const configure = async (serviceMock: ReturnType<typeof createServiceMock>) => {
    await TestBed.configureTestingModule({
      imports: [GanaderosPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        {
          provide: GanaderosService,
          useValue: serviceMock,
        },
        {
          provide: OfflineStatusService,
          useValue: {
            message: signal(null),
          },
        },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    const fixture = TestBed.createComponent(GanaderosPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('should show an empty state when there are no ganaderos registered', async () => {
    const { fixture } = await configure(createServiceMock());

    expect(fixture.nativeElement.textContent).toContain('Todavía no hay ganaderos registrados.');
  });

  it('should show a clear error when the ganaderos list cannot be loaded', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listGanaderos.mockReturnValue(throwError(() => new Error('boom')));
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los ganaderos.');
  });

  it('should not show offline sync state in the admin ganaderos list', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 2,
      syncing: false,
      lastSyncAt: '2026-04-26T10:06:00.000Z',
      lastMessage: 'Hay cambios pendientes.',
      manualRefreshRequired: true,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).not.toContain('Estado de sync');
    expect(fixture.nativeElement.textContent).not.toContain('Última sync');
    expect(fixture.nativeElement.textContent).not.toContain('Necesitás refrescar manualmente la lista para resolver el conflicto remoto.');
  });

  it('should render the ganaderos table with the expected business columns', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listGanaderos.mockReturnValue(
      of([
        {
          id: 'ganadero-1',
          businessIdentifier: 'BO-100',
          name: 'Estancia Norte',
          email: 'norte@hato.bo',
          contactInfo: '',
          active: true,
          version: 1,
          createdAt: '2026-04-26T10:06:00.000Z',
          updatedAt: '2026-04-26T10:06:00.000Z',
          lastSyncedAt: null,
        },
      ] as GanaderoItem[])
    );
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('Identificador');
    expect(fixture.nativeElement.textContent).toContain('Correo');
    expect(fixture.nativeElement.textContent).toContain('Estancia Norte');
  });

  it('should filter the table by business identifier when filters change', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listGanaderos.mockReturnValue(
      of([
        {
          id: 'ganadero-1',
          businessIdentifier: 'BO-100',
          name: 'Estancia Norte',
          email: 'norte@hato.bo',
          contactInfo: '',
          active: true,
          version: 1,
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
          lastSyncedAt: null,
        },
        {
          id: 'ganadero-2',
          businessIdentifier: 'BO-200',
          name: 'Estancia Sur',
          email: 'sur@hato.bo',
          contactInfo: '',
          active: true,
          version: 1,
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
          lastSyncedAt: null,
        },
      ] as GanaderoItem[])
    );
    const { fixture, component } = await configure(serviceMock);

    component.filters.set({ businessIdentifier: 'BO-200' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Estancia Sur');
    expect(fixture.nativeElement.textContent).not.toContain('Estancia Norte');
  });

  it('should ask for confirmation before resetting a ganadero password', async () => {
    const ganadero = {
      id: 'ganadero-1',
      businessIdentifier: 'BO-100',
      name: 'Estancia Norte',
      email: 'norte@hato.bo',
      contactInfo: '',
      active: true,
      version: 1,
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      lastSyncedAt: null,
    };
    const serviceMock = createServiceMock();
    serviceMock.listGanaderos.mockReturnValue(of([ganadero] as GanaderoItem[]));
    const { component, fixture } = await configure(serviceMock);

    component.handleRowAction({ actionId: 'reset-password', row: ganadero });
    await fixture.whenStable();
    fixture.detectChanges();

    expect(overlayContainer.getContainerElement().textContent).toContain('112345AB');
  });

  it('should disable a ganadero after confirmation from the row action', async () => {
    const ganadero = {
      id: 'ganadero-1',
      businessIdentifier: 'BO-100',
      name: 'Estancia Norte',
      email: 'norte@hato.bo',
      contactInfo: '',
      active: true,
      version: 1,
      createdAt: '2026-04-26T10:00:00.000Z',
      updatedAt: '2026-04-26T10:00:00.000Z',
      lastSyncedAt: null,
    };
    const serviceMock = createServiceMock();
    serviceMock.listGanaderos.mockReturnValue(of([ganadero] as GanaderoItem[]));
    const { fixture, component } = await configure(serviceMock);

    component.handleRowAction({ actionId: 'toggle-status', row: ganadero });
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Confirmar baja')
    ) as HTMLButtonElement;
    confirmButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(serviceMock.updateStatus).toHaveBeenCalledWith('ganadero-1', false);
  });

  it('should not show offline sync progress in the admin ganaderos list', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 0,
      syncing: true,
      lastSyncAt: '2026-04-26T10:12:00.000Z',
      lastMessage: 'Sincronización central en curso.',
      manualRefreshRequired: false,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).not.toContain('Sincronizando cambios offline…');
    expect(fixture.nativeElement.textContent).not.toContain('Sincronización central en curso.');
  });
});
