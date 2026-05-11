import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { ActivatedRoute, Router } from '@angular/router';
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from '@angular/material/dialog';
import { of, throwError } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AnimalBirthRegistrationDialogComponent, AnimalDetailPageComponent, AnimalServiceRegistrationDialogComponent, AnimalVetVisitDetailDialogComponent } from './animal-detail-page.component';
import { AnimalsEventsService } from './data-access/animals-events.service';
import { AnimalsHealthEventsService, type AnimalHealthEventItem } from './data-access/animals-health-events.service';
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
    color: null,
    description: null,
    breedUuid: null,
    breedName: null,
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
    father: createAnimal({ uuid: 'father-1', arete: 'PADRE-001', category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }),
    offspring: [createAnimal({ uuid: 'offspring-1', arete: 'CRIA-001' })],
    ancestors: {
      animal: createAnimal(),
      mother: { animal: createAnimal({ uuid: 'mother-1', arete: 'MADRE-001' }) },
      father: { animal: createAnimal({ uuid: 'father-1', arete: 'PADRE-001', category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }) },
    },
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

  const createHealthEvent = (overrides: Partial<AnimalHealthEventItem> = {}): AnimalHealthEventItem => ({
    id: 'health-event-1',
    animalUuid: 'animal-uuid-1',
    healthEventType: 'FIELD_VET_VISIT',
    occurredAt: '2026-05-13T00:00:00.000Z',
    notes: 'Animal atendido y estable',
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'health-operation-1',
    metadata: {
      visit: {
        visitId: 'VISIT-1',
        mode: 'SPECIFIC',
        status: 'ATTENDED',
        veterinarian: { name: 'Dra. Luna', license: 'MV-001' },
      },
      checklist: [],
      clinicalNote: { reason: 'Control post parto', findings: 'Sin fiebre', plan: 'Revisar en 7 días' },
      protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-20T00:00:00.000Z' },
      amount: 150,
      currency: 'BOB',
    },
    clientCreatedAt: '2026-05-13T00:00:00.000Z',
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
    visitId: 'VISIT-1',
    visitMode: 'SPECIFIC',
    visitStatus: 'ATTENDED',
    veterinarianName: 'Dra. Luna',
    nextDueAt: '2026-05-20T00:00:00.000Z',
    ...overrides,
  });

  const configure = async (options: { animalsService?: Partial<AnimalsService>; role?: 'ADMIN' | 'GANADERO'; animal?: AnimalItem; dialogClosedWith?: boolean; genealogy?: AnimalGenealogy; reproductionEvents?: AnimalReproductionEventItem[]; healthEvents?: AnimalHealthEventItem[] } = {}) => {
    const animalsService = {
      getAnimal: vi.fn(() => of(options.animal ?? createAnimal())),
      getGenealogy: vi.fn(() => of(options.genealogy ?? genealogy)),
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
        { provide: AnimalsHealthEventsService, useValue: { listEvents: vi.fn(() => of(options.healthEvents ?? [])) } },
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
    const { fixture } = await configure({ animal: createAnimal({ color: 'Colorado', description: 'Bueno para carne', breedUuid: 'raza-criolla-uuid', breedName: 'Criolla' }) });
    let text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Volver a animales');
    expect(text).toContain('Editar');
    expect(text).toContain('Arete');
    expect(text).toContain('AR-100');
    expect(text).toContain('Marca Sur');
    expect(text).toContain('Raza');
    expect(text).toContain('Criolla');
    expect(text).toContain('Color');
    expect(text).toContain('Colorado');
    expect(text).toContain('Descripción');
    expect(text).toContain('Bueno para carne');
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
    expect(text).toContain('PADRE-001');
    expect(text).toContain('CRIA-001');
  });

  it('should show legacy animals without breed gracefully', async () => {
    const { fixture } = await configure({ animal: createAnimal({ breedUuid: null, breedName: null }) });

    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Raza');
    expect(text).toContain('Sin raza asignada');
  });

  it('should render veterinary visits in Spanish with formatted date, context and details action', async () => {
    const { fixture, dialog } = await configure({ healthEvents: [createHealthEvent()] });

    await selectTab(fixture, 'Salud');
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('13-05-2026');
    expect(text).toContain('Visita veterinaria');
    expect(text).toContain('Motivo: Control post parto');
    expect(text).toContain('Veterinario: Dra. Luna');
    expect(text).toContain('Estado: Atendida');
    expect(text).toContain('Notas: Animal atendido y estable');
    expect(text).toContain('Detalles');
    expect(text).not.toContain('2026-05-13T00:00:00.000Z');
    expect(text).not.toContain('FIELD_VET_VISIT');

    const button = Array.from(fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>).find((candidate) =>
      candidate.textContent?.includes('Detalles'),
    ) as HTMLButtonElement;
    button.click();
    fixture.detectChanges();

    expect(dialog.open).toHaveBeenCalledWith(AnimalVetVisitDetailDialogComponent, expect.objectContaining({
      data: createHealthEvent(),
    }));
  });

  it('should render genealogy as a visual parent-current-offspring tree', async () => {
    const { fixture } = await configure();

    await selectTab(fixture, 'Genealogía');
    const text = fixture.nativeElement.textContent as string;
    const tree = fixture.nativeElement.querySelector('[aria-label="Árbol genealógico del animal"]') as HTMLElement | null;

    expect(tree?.textContent).toContain('Ascendencia');
    expect(tree?.textContent).toContain('Madre');
    expect(tree?.textContent).toContain('MADRE-001');
    expect(tree?.textContent).toContain('Padre');
    expect(tree?.textContent).toContain('PADRE-001');
    expect(tree?.textContent).toContain('Animal actual');
    expect(tree?.textContent).toContain('AR-100');
    expect(tree?.textContent).toContain('Descendencia');
    expect(tree?.textContent).toContain('CRIA-001');
    expect(text.indexOf('Ascendencia')).toBeLessThan(text.indexOf('Animal actual'));
    expect(text.indexOf('Animal actual')).toBeLessThan(text.indexOf('Descendencia'));
  });

  it('should request two genealogy generations and render grandparents above parents', async () => {
    const { fixture, animalsService } = await configure({
      genealogy: {
        ...genealogy,
        ancestors: {
          animal: createAnimal(),
          mother: {
            animal: createAnimal({ uuid: 'mother-1', arete: 'MADRE-001' }),
            mother: { animal: createAnimal({ uuid: 'maternal-grandmother-1', arete: 'ABUELA-M-001' }) },
            father: { animal: createAnimal({ uuid: 'maternal-grandfather-1', arete: 'ABUELO-M-001', category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }) },
          },
          father: {
            animal: createAnimal({ uuid: 'father-1', arete: 'PADRE-001', category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }),
            mother: { animal: createAnimal({ uuid: 'paternal-grandmother-1', arete: 'ABUELA-P-001' }) },
          },
        },
      },
    });

    await selectTab(fixture, 'Genealogía');
    const text = fixture.nativeElement.textContent as string;
    const tree = fixture.nativeElement.querySelector('[aria-label="Árbol genealógico del animal"]') as HTMLElement | null;

    expect(animalsService.getGenealogy).toHaveBeenCalledWith('animal-uuid-1', 2);
    expect(tree?.textContent).toContain('Abuelos');
    expect(tree?.textContent).toContain('ABUELA-M-001');
    expect(tree?.textContent).toContain('ABUELO-M-001');
    expect(tree?.textContent).toContain('ABUELA-P-001');
    expect(text.indexOf('Abuelos')).toBeLessThan(text.indexOf('Madre'));
    expect(text.indexOf('Madre')).toBeLessThan(text.indexOf('Animal actual'));
  });

  it('should show safe empty genealogy and image states for foundation animals', async () => {
    const { fixture } = await configure({
      animalsService: {
        getAnimal: vi.fn(() => of(createAnimal({ motherAnimalUuid: null, fatherAnimalUuid: null }))),
        getGenealogy: vi.fn(() => of({ animal: createAnimal(), mother: null, father: null, offspring: [], ancestors: { animal: createAnimal() } })),
      },
    });

    await selectTab(fixture, 'Genealogía');
    const tree = fixture.nativeElement.querySelector('[aria-label="Árbol genealógico del animal"]') as HTMLElement | null;

    expect(tree?.textContent).toContain('Animal fundador: sin madre/padre registrados');
    expect(tree?.textContent).toContain('Sin padre registrado');
    expect(tree?.textContent).toContain('Sin abuelos registrados');
    expect(tree?.textContent).toContain('Animal actual');
    expect(tree?.textContent).toContain('AR-100');
    expect(tree?.textContent).toContain('Sin crías registradas');
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

  it('should expose detail reproductive actions only for cows and heifers', async () => {
    const eligibleCow = await configure({ animal: createAnimal({ category: ANIMAL_CATEGORY.VACA, sex: ANIMAL_SEX.HEMBRA }) });
    expect(eligibleCow.fixture.nativeElement.textContent).toContain('Registrar servicio');
    expect(eligibleCow.fixture.nativeElement.textContent).toContain('Registrar diagnóstico de preñez');
    expect(eligibleCow.fixture.nativeElement.textContent).toContain('Registrar nacimiento');
    TestBed.resetTestingModule();

    const eligibleHeifer = await configure({ animal: createAnimal({ category: ANIMAL_CATEGORY.VAQUILLONA, sex: ANIMAL_SEX.HEMBRA }) });
    expect(eligibleHeifer.fixture.nativeElement.textContent).toContain('Registrar servicio');
    expect(eligibleHeifer.fixture.nativeElement.textContent).toContain('Registrar diagnóstico de preñez');
    expect(eligibleHeifer.fixture.nativeElement.textContent).toContain('Registrar nacimiento');
    TestBed.resetTestingModule();

    const ineligibleCalf = await configure({ animal: createAnimal({ category: ANIMAL_CATEGORY.TERNERA, sex: ANIMAL_SEX.HEMBRA }) });
    expect(ineligibleCalf.fixture.nativeElement.textContent).not.toContain('Registrar servicio');
    expect(ineligibleCalf.fixture.nativeElement.textContent).not.toContain('Registrar diagnóstico de preñez');
    expect(ineligibleCalf.fixture.nativeElement.textContent).not.toContain('Registrar nacimiento');
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

  it('should summarize the active gestation when the latest positive diagnosis has no later closure event', async () => {
    const { fixture } = await configure({
      reproductionEvents: [
        createReproductionEvent({
          id: 'service-event-1',
          reproductionEventType: 'SERVICE',
          occurredAt: '2026-05-01T09:00:00.000Z',
          metadata: { serviceMethod: 'INSEMINACION_ARTIFICIAL', bullReference: 'Toro catálogo 88' },
        }),
        createReproductionEvent({
          id: 'pregnancy-diagnosis-1',
          reproductionEventType: 'PREGNANCY_DIAGNOSIS',
          occurredAt: '2026-05-10T09:00:00.000Z',
          notes: 'Ecografía positiva',
          metadata: {
            diagnosisDate: '2026-05-10T00:00:00.000Z',
            result: 'PRENADA',
            expectedBirthDate: '2026-06-20T00:00:00.000Z',
            serviceEventUuid: 'service-event-1',
          },
        }),
      ],
    });

    await selectTab(fixture, 'Reproducción');
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Gestación activa');
    expect(text).toContain('Fecha probable de parto');
    expect(text).toContain('2026-06-20');
    expect(text).toContain('Servicio asociado');
    expect(text).toContain('2026-05-01 · INSEMINACION ARTIFICIAL · Toro catálogo 88');
  });

  it('should hide the active gestation summary when a later birth closes the diagnosis', async () => {
    const { fixture } = await configure({
      reproductionEvents: [
        createReproductionEvent({
          id: 'pregnancy-diagnosis-1',
          reproductionEventType: 'PREGNANCY_DIAGNOSIS',
          occurredAt: '2026-05-10T09:00:00.000Z',
          metadata: { result: 'PRENADA', expectedBirthDate: '2026-06-20T00:00:00.000Z' },
        }),
        createReproductionEvent({ id: 'birth-event-1', reproductionEventType: 'BIRTH', occurredAt: '2026-05-11T09:00:00.000Z' }),
      ],
    });

    await selectTab(fixture, 'Reproducción');

    expect(fixture.nativeElement.textContent).not.toContain('Gestación activa');
  });

  it('should hide birth registration for male animals', async () => {
    const { fixture } = await configure({ animal: createAnimal({ category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }) });

    expect(fixture.nativeElement.textContent).not.toContain('Registrar nacimiento');
    expect(fixture.nativeElement.textContent).not.toContain('Registrar servicio');
    expect(fixture.nativeElement.textContent).not.toContain('Registrar diagnóstico de preñez');
  });

  it('should hide active gestation date summary for ineligible categories', async () => {
    const { fixture } = await configure({
      animal: createAnimal({ category: ANIMAL_CATEGORY.TERNERA, sex: ANIMAL_SEX.HEMBRA }),
      reproductionEvents: [
        createReproductionEvent({
          id: 'pregnancy-diagnosis-1',
          reproductionEventType: 'PREGNANCY_DIAGNOSIS',
          occurredAt: '2026-05-10T09:00:00.000Z',
          metadata: { result: 'PRENADA', expectedBirthDate: '2026-06-20T00:00:00.000Z' },
        }),
      ],
    });

    await selectTab(fixture, 'Reproducción');

    expect(fixture.nativeElement.textContent).not.toContain('Gestación activa');
    expect(fixture.nativeElement.textContent).not.toContain('Fecha probable de parto: 2026-06-20');
  });

  it('should show a forbidden-friendly error state when detail loading is rejected', async () => {
    const { fixture } = await configure({
      animalsService: { getAnimal: vi.fn(() => throwError(() => new Error('forbidden'))) },
    });

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar la ficha animal');
  });
});

describe('AnimalServiceRegistrationDialogComponent', () => {
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'ganadero-uuid-1',
    arete: 'AR-100',
    marca: 'Marca Sur',
    tatuaje: 'TS-10',
    category: ANIMAL_CATEGORY.TORO,
    sex: ANIMAL_SEX.MACHO,
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
    color: null,
    description: null,
    breedUuid: null,
    breedName: null,
    ...overrides,
  });

  const createBullCandidates = () => Array.from({ length: 12 }, (_value, index) => createAnimal({
    uuid: `bull-${index + 1}`,
    arete: `TORO-${String(index + 1).padStart(2, '0')}`,
    marca: index === 10 ? 'Especial Norte' : `Marca ${index + 1}`,
    tatuaje: `T-${index + 1}`,
    updatedAt: `2026-05-${String(12 - index).padStart(2, '0')}T10:00:00.000Z`,
  }));

  const configureDialog = async (animals: AnimalItem[] = createBullCandidates()) => {
    const animalsService = { listAnimals: vi.fn(() => of(animals)) };
    const reproductionEventsService = { createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Servicio encolado.' })) };
    const dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AnimalServiceRegistrationDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AnimalsService, useValue: animalsService },
        { provide: AnimalsReproductionEventsService, useValue: reproductionEventsService },
        { provide: MAT_DIALOG_DATA, useValue: { animalUuid: 'animal-uuid-1', ownerGanaderoId: 'ganadero-uuid-1' } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalServiceRegistrationDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, animalsService, reproductionEventsService, dialogRef };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should default the bull autocomplete to the latest 10 male candidates and exclude the current animal', async () => {
    const { component } = await configureDialog([
      createAnimal({ uuid: 'animal-uuid-1', arete: 'CURRENT' }),
      ...createBullCandidates(),
      createAnimal({ uuid: 'cow-1', arete: 'VACA-001', category: ANIMAL_CATEGORY.VACA, sex: ANIMAL_SEX.HEMBRA }),
    ]);

    expect(component.sireOptions()).toHaveLength(10);
    expect(component.sireOptions().map((sire) => sire.uuid)).toEqual(['bull-1', 'bull-2', 'bull-3', 'bull-4', 'bull-5', 'bull-6', 'bull-7', 'bull-8', 'bull-9', 'bull-10']);
  });

  it('should filter bull autocomplete options by visible identifiers and preserve a 10 item limit', async () => {
    const { component } = await configureDialog();

    component.form.controls.fatherSearch.setValue('Especial');

    expect(component.sireOptions().map((sire) => sire.uuid)).toEqual(['bull-11']);
    expect(component.sireOptions()).toHaveLength(1);
  });

  it('should select the father from the bull autocomplete and submit the existing service payload semantics', async () => {
    const { component, reproductionEventsService, dialogRef } = await configureDialog();

    component.selectSire({ option: { value: 'bull-2' } } as never);
    component.submit();

    expect(component.form.controls.fatherAnimalUuid.value).toBe('bull-2');
    expect(component.form.controls.fatherSearch.value).toBe('TORO-02 · Marca 2 · T-2');
    expect(reproductionEventsService.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      animalUuid: 'animal-uuid-1',
      reproductionEventType: 'SERVICE',
      metadata: expect.objectContaining({ fatherAnimalUuid: 'bull-2' }),
    }));
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });
});

describe('AnimalBirthRegistrationDialogComponent', () => {
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'ganadero-uuid-1',
    arete: 'AR-100',
    marca: 'Marca Sur',
    tatuaje: 'TS-10',
    category: ANIMAL_CATEGORY.TORO,
    sex: ANIMAL_SEX.MACHO,
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
    color: null,
    description: null,
    breedUuid: null,
    breedName: null,
    ...overrides,
  });

  const configureDialog = async (online = true) => {
    const animalsService = {
      listAnimals: vi.fn(() => of([createAnimal({ uuid: 'father-uuid-1', arete: 'TORO-001' })])),
      registerBirth: vi.fn(() => of({
        eventId: 'birth-event-1',
        motherAnimalUuid: 'mother-uuid-1',
        fatherAnimalUuid: null,
        birthDate: '2026-05-10',
        offspringCount: 2,
        offspring: [],
      })),
    };
    const dialogRef = { close: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [AnimalBirthRegistrationDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AnimalsService, useValue: animalsService },
        { provide: OfflineStatusService, useValue: { isOnline: signal(online) } },
        { provide: MAT_DIALOG_DATA, useValue: { motherUuid: 'mother-uuid-1', ownerGanaderoId: 'ganadero-uuid-1' } },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalBirthRegistrationDialogComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, animalsService, dialogRef };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should start with one calf row and submit multiple calves after adding another one', async () => {
    const { fixture, component, animalsService, dialogRef } = await configureDialog();

    expect(fixture.nativeElement.textContent).toContain('El registro de parto requiere conexión para crear el ternero y actualizar la genealogía en una sola operación.');
    expect(component.offspring.length).toBe(1);

    component.offspring.at(0).patchValue({ arete: 'CRIA-001', category: ANIMAL_CATEGORY.TERNERA, weightKg: 31.25 });
    component.addOffspring();
    component.offspring.at(1).patchValue({ marca: 'CRIA-MARCA-002', category: ANIMAL_CATEGORY.TERNERO, weightKg: 32 });
    fixture.detectChanges();

    expect(component.offspring.length).toBe(2);
    expect(fixture.nativeElement.textContent).toContain('Ternero 2');

    component.submit();

    expect(animalsService.registerBirth).toHaveBeenCalledWith('mother-uuid-1', expect.objectContaining({
      offspring: [
        expect.objectContaining({ arete: 'CRIA-001', sex: ANIMAL_SEX.HEMBRA, weightKg: 31.25 }),
        expect.objectContaining({ marca: 'CRIA-MARCA-002', sex: ANIMAL_SEX.MACHO, weightKg: 32 }),
      ],
    }));
    expect(dialogRef.close).toHaveBeenCalledWith(true);
  });

  it('should block submission when any calf is missing a visible identifier', async () => {
    const { component, animalsService } = await configureDialog();

    component.offspring.at(0).patchValue({ arete: 'CRIA-001' });
    component.addOffspring();
    component.submit();

    expect(component.errorMessage()).toContain('Informá al menos arete, marca o tatuaje para cada ternero.');
    expect(animalsService.registerBirth).not.toHaveBeenCalled();
  });

  it('should disable online-only birth registration while offline', async () => {
    const { fixture, component, animalsService } = await configureDialog(false);

    expect(fixture.nativeElement.textContent).toContain('Necesitás conexión para registrar el parto.');
    component.offspring.at(0).patchValue({ arete: 'CRIA-001' });
    component.submit();

    expect(animalsService.registerBirth).not.toHaveBeenCalled();
  });
});

describe('AnimalVetVisitDetailDialogComponent', () => {
  const createHealthEvent = (metadataOverrides: Record<string, unknown> = {}): AnimalHealthEventItem => ({
    id: 'health-event-1',
    animalUuid: 'animal-uuid-1',
    healthEventType: 'FIELD_VET_VISIT',
    occurredAt: '2026-05-13T00:00:00.000Z',
    notes: 'Animal atendido y estable',
    performedByUserId: 'user-1',
    sourceChannel: 'ONLINE',
    operationId: 'health-operation-1',
    metadata: {
      visit: { visitId: 'VISIT-1', mode: 'SPECIFIC', status: 'ATTENDED', veterinarian: { name: 'Dra. Luna', license: 'MV-001' } },
      checklist: [],
      clinicalNote: { reason: 'Control post parto', findings: 'Sin fiebre', plan: 'Revisar en 7 días' },
      protocol: { status: 'FOLLOW_UP_REQUIRED', nextDueAt: '2026-05-20T00:00:00.000Z' },
      amount: 150,
      currency: 'BOB',
      ...metadataOverrides,
    },
    clientCreatedAt: '2026-05-13T00:00:00.000Z',
    createdAt: '2026-05-13T00:00:00.000Z',
    updatedAt: '2026-05-13T00:00:00.000Z',
    visitId: 'VISIT-1',
    visitMode: 'SPECIFIC',
    visitStatus: 'ATTENDED',
    veterinarianName: 'Dra. Luna',
    nextDueAt: '2026-05-20T00:00:00.000Z',
  });

  afterEach(() => TestBed.resetTestingModule());

  it('should show full veterinary visit details including cost when available', async () => {
    await TestBed.configureTestingModule({
      imports: [AnimalVetVisitDetailDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: createHealthEvent() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalVetVisitDetailDialogComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent as string;

    expect(text).toContain('Detalles de visita veterinaria');
    expect(text).toContain('13-05-2026');
    expect(text).toContain('Animal específico');
    expect(text).toContain('Atendida');
    expect(text).toContain('Control post parto');
    expect(text).toContain('Dra. Luna');
    expect(text).toContain('MV-001');
    expect(text).toContain('Animal atendido y estable');
    expect(text).toContain('Sin fiebre');
    expect(text).toContain('20-05-2026');
    expect(text).toContain('150 BOB');
  });

  it('should handle missing veterinary visit cost gracefully', async () => {
    await TestBed.configureTestingModule({
      imports: [AnimalVetVisitDetailDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: createHealthEvent({ amount: undefined, currency: undefined }) },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalVetVisitDetailDialogComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Costo');
    expect(fixture.nativeElement.textContent).toContain('No informado');
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
