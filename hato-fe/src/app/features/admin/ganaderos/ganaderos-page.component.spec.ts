import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { GanaderosPageComponent } from './ganaderos-page.component';
import { GanaderosService, type GanaderosSyncState } from './data-access/ganaderos.service';

describe('GanaderosPageComponent', () => {
  const createServiceMock = () => ({
    listGanaderos: () => of([]),
    createGanadero: () => of({ outcome: 'synced', message: 'Ganadero registrado correctamente.' }),
    updateStatus: () => of({ outcome: 'synced', message: 'Ganadero dado de baja correctamente.' }),
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

    const fixture = TestBed.createComponent(GanaderosPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('should show explicit required messages for the ganadero form', async () => {
    const { fixture, component } = await configure(createServiceMock());

    component.submitCreate();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá el identificador de negocio.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá el nombre del ganadero.');
  });

  it('should keep the register button disabled until the ganadero form is valid', async () => {
    const { fixture } = await configure(createServiceMock());

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);
  });

  it('should show an empty state when there are no ganaderos registered', async () => {
    const { fixture } = await configure(createServiceMock());

    expect(fixture.nativeElement.textContent).toContain('Todavía no hay ganaderos registrados.');
  });

  it('should show a clear error when the ganaderos list cannot be loaded', async () => {
    const { fixture } = await configure({
      ...createServiceMock(),
      listGanaderos: () => throwError(() => new Error('boom')),
    });

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar los ganaderos.');
  });

  it('should show helper guidance for status filters and registration fields', async () => {
    const { fixture } = await configure(createServiceMock());

    expect(fixture.nativeElement.textContent).toContain('Elegí si querés ver activos, dados de baja o todos.');
    expect(fixture.nativeElement.textContent).toContain('Usá el identificador único definido por negocio.');
  });

  it('should show sync visibility and manual refresh guidance for ganaderos', async () => {
    const serviceMock = createServiceMock();
    serviceMock.syncState.set({
      pending: 2,
      syncing: false,
      lastSyncAt: '2026-04-26T10:06:00.000Z',
      lastMessage: 'Hay cambios pendientes.',
      manualRefreshRequired: true,
    });
    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('Estado de sync: 2 pendiente(s)');
    expect(fixture.nativeElement.textContent).toContain('Necesitás refrescar manualmente la lista para resolver el conflicto remoto.');
  });

  it('should show queued feedback when a ganadero is created offline first', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listGanaderos = vi
      .fn()
      .mockReturnValueOnce(of([]))
      .mockReturnValueOnce(
        of([
          {
            id: 'pending:ganadero-1',
            businessIdentifier: 'BO-100',
            name: 'Estancia Norte',
            active: true,
            version: 0,
            createdAt: '2026-04-26T10:06:00.000Z',
            updatedAt: '2026-04-26T10:06:00.000Z',
            lastSyncedAt: null,
          },
        ])
      );
    serviceMock.createGanadero = () => of({ outcome: 'queued', message: 'Alta de ganadero encolada. Se enviará al reconectar.' });
    const { fixture, component } = await configure(serviceMock);

    component.createForm.setValue({ businessIdentifier: 'BO-100', name: 'Estancia Norte' });
    component.submitCreate();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Alta de ganadero encolada. Se enviará al reconectar.');
  });
});
