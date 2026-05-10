import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { AnimalDetailPageComponent } from './animal-detail-page.component';
import { AnimalsEventsService } from './data-access/animals-events.service';
import { AnimalsHealthEventsService } from './data-access/animals-health-events.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import { AnimalsReproductionEventsService, type AnimalReproductionEventItem } from './data-access/animals-reproduction-events.service';
import { ANIMAL_CATEGORY, ANIMAL_SEX, AnimalsService, type AnimalItem, type AnimalGenealogy } from './data-access/animals.service';

describe('AnimalDetailPageComponent', () => {
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'ganadero-uuid-1',
    arete: 'AR-100',
    marca: 'Marca Sur',
    tatuaje: 'TS-10',
    category: ANIMAL_CATEGORY.VACA,
    sex: ANIMAL_SEX.HEMBRA,
    active: true,
    birthDate: '2024-04-26',
    admissionDate: '2026-04-26',
    weightKg: 420,
    createdAt: '2026-04-26T10:00:00.000Z',
    version: 1,
    updatedAt: '2026-04-26T10:00:00.000Z',
    lastSyncedAt: '2026-04-26T10:05:00.000Z',
    motherAnimalUuid: null,
    fatherAnimalUuid: null,
    ...overrides,
  });

  const createImage = (): AnimalImageItem => ({
    id: 'image-1',
    animalUuid: 'animal-uuid-1',
    operationId: 'image-1',
    fileName: 'vaca.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 1200,
    checksumSha256: 'a'.repeat(64),
    capturedAt: '2026-04-26T10:00:00.000Z',
    sourceChannel: 'ONLINE',
    binaryRef: 'image-1',
    previewUrl: 'blob:image-1',
    clientCreatedAt: '2026-04-26T10:00:00.000Z',
    createdAt: '2026-04-26T10:00:00.000Z',
    updatedAt: '2026-04-26T10:00:00.000Z',
    syncState: 'SYNCED',
  });

  const genealogy: AnimalGenealogy = {
    animal: createAnimal(),
    mother: createAnimal({ uuid: 'mother-1', arete: 'MADRE-001' }),
    father: null,
    offspring: [createAnimal({ uuid: 'offspring-1', arete: 'CRIA-001' })],
  };

  const createReproductionEvent = (overrides: Partial<AnimalReproductionEventItem> = {}): AnimalReproductionEventItem => ({
    id: 'service-event-1',
    animalUuid: 'animal-uuid-1',
    reproductionEventType: 'SERVICE',
    occurredAt: '2026-05-01T09:00:00.000Z',
    notes: 'Servicio IA',
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'service-operation-1',
    metadata: { serviceMethod: 'INSEMINACION_ARTIFICIAL', bullReference: 'Toro catálogo 88' },
    clientCreatedAt: '2026-05-01T09:00:00.000Z',
    createdAt: '2026-05-01T09:00:01.000Z',
    updatedAt: '2026-05-01T09:00:01.000Z',
    ...overrides,
  });

  const configure = async (options: { animalsService?: Partial<AnimalsService>; role?: 'ADMIN' | 'GANADERO'; animal?: AnimalItem; dialogClosedWith?: boolean; reproductionEvents?: AnimalReproductionEventItem[] } = {}) => {
    const animalsService = {
      getAnimal: vi.fn(() => of(options.animal ?? createAnimal())),
      getGenealogy: vi.fn(() => of(genealogy)),
      registerBirth: vi.fn(),
      ...options.animalsService,
    };
    const dialog = { open: vi.fn(() => ({ afterClosed: () => of(options.dialogClosedWith ?? false) })) };
    await TestBed.configureTestingModule({
      imports: [AnimalDetailPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNoopAnimations(),
        { provide: AnimalsService, useValue: animalsService },
        { provide: AnimalsImagesService, useValue: { listImages: vi.fn(() => of([createImage()])) } },
        { provide: AnimalsEventsService, useValue: { listEvents: vi.fn(() => of([{ type: 'OBSERVATION', occurredAt: '2026-04-26T10:00:00.000Z', notes: 'Control de campo' }])) } },
        { provide: AnimalsHealthEventsService, useValue: { listEvents: vi.fn(() => of([])) } },
        { provide: AnimalsReproductionEventsService, useValue: { listEvents: vi.fn(() => of(options.reproductionEvents ?? [])) } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'animal-uuid-1' } } } },
        { provide: Router, useValue: { navigateByUrl: vi.fn(() => Promise.resolve(true)) } },
        { provide: AuthService, useValue: { currentUser: signal({ role: options.role ?? 'GANADERO', status: 'ACTIVE' }) } },
        { provide: MatDialog, useValue: dialog },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalDetailPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, animalsService, router: TestBed.inject(Router), dialog };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should render the read-only ficha, gallery, history, reproduction and genealogy sections', async () => {
    const { fixture } = await configure();
    let text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Volver a animales');
    expect(text).toContain('Editar');
    expect(text).toContain('Arete');
    expect(text).toContain('AR-100');
    expect(text).toContain('Marca Sur');
    expect(text).toContain('Hembra');
    expect(text).toContain('420 kg');
    expect(text).toContain('Imágenes');
    await selectTab(fixture, 'Imágenes');
    expect(fixture.nativeElement.querySelector('img')?.getAttribute('alt')).toContain('AR-100');
    await selectTab(fixture, 'Historial');
    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Control de campo');
    await selectTab(fixture, 'Salud');
    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Sin eventos sanitarios registrados');
    await selectTab(fixture, 'Genealogía');
    text = fixture.nativeElement.textContent as string;
    expect(text).toContain('MADRE-001');
    expect(text).toContain('CRIA-001');
  });

  it('should show safe empty genealogy and image states for foundation animals', async () => {
    const { fixture } = await configure({
      animalsService: {
        getAnimal: vi.fn(() => of(createAnimal({ motherAnimalUuid: null, fatherAnimalUuid: null }))),
        getGenealogy: vi.fn(() => of({ animal: createAnimal(), mother: null, father: null, offspring: [] })),
      },
    });

    await selectTab(fixture, 'Genealogía');
    expect(fixture.nativeElement.textContent).toContain('Animal fundador: sin madre/padre registrados');
    expect(fixture.nativeElement.textContent).toContain('Sin crías registradas');
  });

  it('should expose birth registration only for female animals and refresh after dialog success', async () => {
    const { fixture, animalsService, dialog } = await configure({ dialogClosedWith: true });

    expect(fixture.nativeElement.textContent).toContain('Registrar nacimiento');
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((candidate) =>
      candidate.textContent?.includes('Registrar nacimiento'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ motherUuid: 'animal-uuid-1', ownerGanaderoId: 'ganadero-uuid-1' }),
    }));
    expect(animalsService.getAnimal).toHaveBeenCalledTimes(2);
  });

  it('should expose service registration for female animals and refresh after dialog success', async () => {
    const { fixture, animalsService, dialog } = await configure({ dialogClosedWith: true });

    expect(fixture.nativeElement.textContent).toContain('Registrar servicio');
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((candidate) =>
      candidate.textContent?.includes('Registrar servicio'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({ animalUuid: 'animal-uuid-1', ownerGanaderoId: 'ganadero-uuid-1' }),
    }));
    expect(animalsService.getAnimal).toHaveBeenCalledTimes(2);
  });

  it('should expose pregnancy diagnosis registration for female animals and refresh after dialog success', async () => {
    const { fixture, animalsService, dialog } = await configure({
      dialogClosedWith: true,
      reproductionEvents: [
        createReproductionEvent(),
        createReproductionEvent({ id: 'birth-event-1', reproductionEventType: 'BIRTH' }),
      ],
    });

    expect(fixture.nativeElement.textContent).toContain('Registrar diagnóstico de preñez');
    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((candidate) =>
      candidate.textContent?.includes('Registrar diagnóstico de preñez'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({
      data: expect.objectContaining({
        animalUuid: 'animal-uuid-1',
        serviceOptions: [{ uuid: 'service-event-1', label: '2026-05-01 · INSEMINACION ARTIFICIAL · Toro catálogo 88' }],
      }),
    }));
    expect(animalsService.getAnimal).toHaveBeenCalledTimes(2);
  });

  it('should show expected birth date for positive pregnancy diagnosis events', async () => {
    const { fixture } = await configure({
      reproductionEvents: [
        createReproductionEvent({
          id: 'pregnancy-diagnosis-1',
          reproductionEventType: 'PREGNANCY_DIAGNOSIS',
          occurredAt: '2026-05-10T09:00:00.000Z',
          notes: 'Ecografía positiva',
          metadata: {
            diagnosisDate: '2026-05-10T00:00:00.000Z',
            result: 'PRENADA',
            expectedBirthDate: '2027-02-14T00:00:00.000Z',
          },
        }),
      ],
    });

    await selectTab(fixture, 'Reproducción');

    expect(fixture.nativeElement.textContent).toContain('Diagnóstico de preñez');
    expect(fixture.nativeElement.textContent).toContain('Fecha probable de parto: 2027-02-14');
  });

  it('should hide birth registration for male animals', async () => {
    const { fixture } = await configure({ animal: createAnimal({ category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }) });

    expect(fixture.nativeElement.textContent).not.toContain('Registrar nacimiento');
    expect(fixture.nativeElement.textContent).not.toContain('Registrar servicio');
    expect(fixture.nativeElement.textContent).not.toContain('Registrar diagnóstico de preñez');
  });

  it('should show a forbidden-friendly error state when detail loading is rejected', async () => {
    const { fixture } = await configure({
      animalsService: { getAnimal: vi.fn(() => throwError(() => new Error('forbidden'))) },
    });

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar la ficha animal');
  });
});

async function selectTab(fixture: { nativeElement: HTMLElement; detectChanges: () => void; whenStable: () => Promise<unknown> }, label: string) {
  const tab = Array.from(fixture.nativeElement.querySelectorAll('[role="tab"]')).find((candidate) =>
    candidate.textContent?.includes(label),
  ) as HTMLElement;
  tab.click();
  await fixture.whenStable();
  fixture.detectChanges();
}
