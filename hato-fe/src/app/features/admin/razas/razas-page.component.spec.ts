import { OverlayContainer } from '@angular/cdk/overlay';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of, throwError } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { RazasService, type RazaItem } from './data-access/razas.service';
import { RazasPageComponent } from './razas-page.component';

describe('RazasPageComponent', () => {
  let overlayContainer: OverlayContainer;

  const createRaza = (overrides: Partial<RazaItem> = {}): RazaItem => ({
    uuid: 'raza-1',
    nombre: 'Criolla',
    descripcion: 'Adaptada al monte chaqueño.',
    origen: 'Bolivia',
    tipo: 'UNCLASSIFIED',
    activo: true,
    sortOrder: 1,
    version: 1,
    createdAt: '2026-05-10T10:00:00',
    updatedAt: '2026-05-10T10:00:00',
    ...overrides,
  });

  const createServiceMock = () => ({
    listAll: vi.fn(() => of([] as RazaItem[])),
    create: vi.fn(() => of({ outcome: 'synced', message: 'Raza creada correctamente.', raza: createRaza() })),
    update: vi.fn(() => of({ outcome: 'synced', message: 'Raza actualizada correctamente.', raza: createRaza() })),
    setActive: vi.fn(() => of({ outcome: 'synced', message: 'Raza desactivada correctamente.', raza: createRaza({ activo: false }) })),
  });

  const configure = async (serviceMock: ReturnType<typeof createServiceMock>, offlineMessage: string | null = null) => {
    await TestBed.configureTestingModule({
      imports: [RazasPageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: RazasService, useValue: serviceMock },
        { provide: OfflineStatusService, useValue: { message: signal(offlineMessage) } },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    const fixture = TestBed.createComponent(RazasPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should render the admin table without duplicating route header title text', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listAll.mockReturnValue(of([createRaza(), createRaza({ uuid: 'raza-2', nombre: 'Brangus', sortOrder: 2 })]));

    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.querySelector('h1')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Nombre');
    expect(fixture.nativeElement.textContent).toContain('Criolla');
    expect(fixture.nativeElement.textContent).toContain('Brangus');
  });

  it('should show online-only guidance and disable create when offline', async () => {
    const { fixture } = await configure(createServiceMock(), 'Estás sin conexión.');

    const createButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((button) =>
      button.textContent?.includes('Nueva raza')
    ) as HTMLButtonElement;

    expect(fixture.nativeElement.textContent).toContain('La gestión de razas requiere conexión.');
    expect(createButton.disabled).toBe(true);
  });

  it('should open create dialog and send the submitted form to the service', async () => {
    const serviceMock = createServiceMock();
    const { fixture } = await configure(serviceMock);

    const createButton = (Array.from(fixture.nativeElement.querySelectorAll('button')) as HTMLButtonElement[]).find((button) =>
      button.textContent?.includes('Nueva raza')
    ) as HTMLButtonElement;
    createButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const overlay = overlayContainer.getContainerElement();
    (overlay.querySelector('input[formControlName="nombre"]') as HTMLInputElement).value = 'Brangus';
    (overlay.querySelector('input[formControlName="nombre"]') as HTMLInputElement).dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
    const saveButton = Array.from(overlay.querySelectorAll('button')).find((button) => button.textContent?.includes('Crear raza')) as HTMLButtonElement;
    saveButton.click();
    await fixture.whenStable();

    expect(serviceMock.create).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Brangus', tipo: 'UNCLASSIFIED' }));
  });

  it('should confirm and deactivate an active raza from the row action', async () => {
    const raza = createRaza();
    const serviceMock = createServiceMock();
    serviceMock.listAll.mockReturnValue(of([raza]));
    const { fixture, component } = await configure(serviceMock);

    component.handleRowAction({ actionId: 'toggle-active', row: raza });
    await fixture.whenStable();
    fixture.detectChanges();

    const confirmButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Desactivar')
    ) as HTMLButtonElement;
    confirmButton.click();
    await fixture.whenStable();

    expect(serviceMock.setActive).toHaveBeenCalledWith('raza-1', false);
  });

  it('should show a clear loading error when razas cannot be loaded', async () => {
    const serviceMock = createServiceMock();
    serviceMock.listAll.mockReturnValue(throwError(() => new Error('boom')));

    const { fixture } = await configure(serviceMock);

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar las razas.');
  });
});
