import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AnimalsPageComponent } from './animals-page.component';
import { GanaderosService } from '../ganaderos/data-access/ganaderos.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import { AnimalsReproductionEventsService } from './data-access/animals-reproduction-events.service';
import {
  ANIMAL_CATEGORY,
  ANIMAL_SEX,
  AnimalsService,
  type AnimalItem,
  type AnimalsSyncState,
} from './data-access/animals.service';
import { AnimalsEventsService } from './data-access/animals-events.service';

describe('AnimalsPageComponent', () => {
  let overlayContainer: OverlayContainer;

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

  const createAnimalsServiceMock = () => ({
    listAnimals: vi.fn(() => of([] as AnimalItem[])),
    createAnimal: vi.fn(() => of({ outcome: 'queued', message: 'Alta de animal encolada. Se disparó la sincronización automática.' })),
    updateAnimal: vi.fn(() => of({ outcome: 'queued', message: 'Actualización de animal encolada. Se disparó la sincronización automática.' })),
    syncState: signal<AnimalsSyncState>({
      pending: 0,
      syncing: false,
      lastSyncAt: null,
      lastMessage: null,
      manualRefreshRequired: false,
    }),
  });

  const createEventsServiceMock = () => ({
    createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento animal encolado. Se disparó la sincronización automática.' })),
    createCastrationEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento de castración encolado. Se disparó la sincronización automática.' })),
  });

  const createReproductionEventsServiceMock = () => ({
    createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento reproductivo encolado. Se disparó la sincronización automática.' })),
  });

  const createImagesServiceMock = () => ({
    listImages: vi.fn((_animalUuid: string) => of([] as AnimalImageItem[])),
    addImages: vi.fn(() => of({ outcome: 'queued', message: 'Imágenes encoladas. Se disparó la sincronización automática.' })),
  });

  const createGanaderosServiceMock = () => ({
    listGanaderos: vi.fn(() => of([{ id: 'ganadero-uuid-1', businessIdentifier: 'NIT-1', name: 'Ganadero Uno' }])),
  });

  const configure = async (
    animalsServiceMock = createAnimalsServiceMock(),
    eventsServiceMock = createEventsServiceMock(),
    reproductionEventsServiceMock = createReproductionEventsServiceMock(),
    imagesServiceMock = createImagesServiceMock(),
    ganaderosServiceMock = createGanaderosServiceMock(),
  ) => {
    await TestBed.configureTestingModule({
      imports: [AnimalsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNoopAnimations(),
        { provide: AnimalsService, useValue: animalsServiceMock },
        { provide: AnimalsEventsService, useValue: eventsServiceMock },
        { provide: AnimalsReproductionEventsService, useValue: reproductionEventsServiceMock },
        { provide: AnimalsImagesService, useValue: imagesServiceMock },
        { provide: GanaderosService, useValue: ganaderosServiceMock },
        { provide: OfflineStatusService, useValue: { message: signal(null) } },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'ADMIN', status: 'ACTIVE' }),
          },
        },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    const fixture = TestBed.createComponent(AnimalsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      router: TestBed.inject(Router),
      animalsServiceMock,
      eventsServiceMock,
      reproductionEventsServiceMock,
      imagesServiceMock,
    };
  };

  it('should render the animals data table with the sex column and without legacy global filters', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal({ color: 'Colorado', breedUuid: 'raza-criolla-uuid', breedName: 'Criolla' })]));
    const { fixture } = await configure(animalsServiceMock);

    expect(fixture.nativeElement.textContent).toContain('Estado de sync:');
    expect(fixture.nativeElement.textContent).toContain('Sexo');
    expect(fixture.nativeElement.textContent).toContain('Hembra');
    expect(fixture.nativeElement.textContent).toContain('Raza');
    expect(fixture.nativeElement.textContent).toContain('Criolla');
    expect(fixture.nativeElement.textContent).toContain('Colorado');
    expect(fixture.nativeElement.textContent).toContain('AR-100');
    expect(fixture.nativeElement.textContent).not.toContain('UUID owner actual');
    expect(fixture.nativeElement.textContent).not.toContain('Estado operativo');
  });

  it('should navigate to the role-aware full-page create form from the toolbar button', async () => {
    const { fixture } = await configure();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const createButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Nuevo animal'),
    ) as HTMLButtonElement;

    expect(createButton.classList).toContain('primary-action-button');
    expect(createButton.querySelector('mat-icon')?.textContent?.trim()).toBe('add');

    createButton.click();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/admin/animales/nuevo');
  });

  it('should navigate to the role-aware full-page edit form from the row action', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal({ category: ANIMAL_CATEGORY.TERNERA, sex: ANIMAL_SEX.HEMBRA })]));
    const { fixture, router } = await configure(animalsServiceMock);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const editButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Editar ficha'),
    ) as HTMLButtonElement;
    editButton.click();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/admin/animales/animal-uuid-1/editar');
  });

  it('should navigate to the role-aware animal detail page from the view row action', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal({ uuid: 'animal-detail-1' })]));
    const { fixture, router } = await configure(animalsServiceMock);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const viewButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Ver ficha'),
    ) as HTMLButtonElement;
    viewButton.click();
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/admin/animales/animal-detail-1');
  });

  it('should enqueue an operative event from the row action dialog', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const eventsServiceMock = createEventsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    const { fixture } = await configure(animalsServiceMock, eventsServiceMock);

    const operativeButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Evento operativo'),
    ) as HTMLButtonElement;
    operativeButton.click();
    await fixture.whenStable();

    const submitButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Registrar evento'),
    ) as HTMLButtonElement;
    submitButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(eventsServiceMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        animalUuid: 'animal-uuid-1',
        type: 'OBSERVATION',
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Evento animal encolado. Se disparó la sincronización automática.');
  });

  it('should enqueue a castration event from the dedicated row action', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const eventsServiceMock = createEventsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal({ category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO })]));
    const { fixture } = await configure(animalsServiceMock, eventsServiceMock);

    const castrationButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Castración'),
    ) as HTMLButtonElement;
    castrationButton.click();
    await fixture.whenStable();

    const submitButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Registrar evento'),
    ) as HTMLButtonElement;
    submitButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(eventsServiceMock.createCastrationEvent).toHaveBeenCalledWith(
      'animal-uuid-1',
      expect.objectContaining({ occurredAt: expect.any(String) }),
    );
    expect(fixture.nativeElement.textContent).toContain('Evento de castración encolado. Se disparó la sincronización automática.');
  });

  it('should show castration row actions only for male calves and bulls', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([
      createAnimal({ uuid: 'bull-1', category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }),
      createAnimal({ uuid: 'calf-1', category: ANIMAL_CATEGORY.TERNERO, sex: ANIMAL_SEX.MACHO }),
      createAnimal({ uuid: 'ox-1', category: ANIMAL_CATEGORY.BUEY, sex: ANIMAL_SEX.MACHO }),
      createAnimal({ uuid: 'cow-1', category: ANIMAL_CATEGORY.VACA, sex: ANIMAL_SEX.HEMBRA }),
    ]));
    const { component } = await configure(animalsServiceMock);
    const castrationAction = component.actions.find((action) => action.label === 'Castración');
    const operativeAction = component.actions.find((action) => action.label === 'Evento operativo');

    expect(castrationAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }))).toBe(true);
    expect(castrationAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.TERNERO, sex: ANIMAL_SEX.MACHO }))).toBe(true);
    expect(castrationAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.BUEY, sex: ANIMAL_SEX.MACHO }))).toBe(false);
    expect(castrationAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.VACA, sex: ANIMAL_SEX.HEMBRA }))).toBe(false);
    expect(operativeAction?.visible).toBeUndefined();
  });

  it('should enqueue a reproduction event from the row action dialog', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const reproductionEventsServiceMock = createReproductionEventsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    const { fixture } = await configure(
      animalsServiceMock,
      createEventsServiceMock(),
      reproductionEventsServiceMock,
    );

    const reproductionButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Evento reproductivo'),
    ) as HTMLButtonElement;
    reproductionButton.click();
    await fixture.whenStable();

    const submitButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Registrar evento reproductivo'),
    ) as HTMLButtonElement;
    submitButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(reproductionEventsServiceMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        animalUuid: 'animal-uuid-1',
        reproductionEventType: 'SERVICE',
      }),
    );
    expect(fixture.nativeElement.textContent).toContain('Evento reproductivo encolado. Se disparó la sincronización automática.');
  });

  it('should show reproductive row actions only for cows and heifers', async () => {
    const { component } = await configure();
    const reproductionAction = component.actions.find((action) => action.label === 'Evento reproductivo');

    expect(reproductionAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.VACA, sex: ANIMAL_SEX.HEMBRA }))).toBe(true);
    expect(reproductionAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.VAQUILLONA, sex: ANIMAL_SEX.HEMBRA }))).toBe(true);
    expect(reproductionAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.TERNERA, sex: ANIMAL_SEX.HEMBRA }))).toBe(false);
    expect(reproductionAction?.visible?.(createAnimal({ category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }))).toBe(false);
  });

  it('should not offer birth registration from the legacy row reproduction event dialog', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    const { fixture } = await configure(animalsServiceMock);

    const reproductionButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Evento reproductivo'),
    ) as HTMLButtonElement;
    reproductionButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const typeSelect = overlayContainer.getContainerElement().querySelector('mat-select') as HTMLElement;
    typeSelect.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(overlayContainer.getContainerElement().textContent).toContain('Registrar evento reproductivo');
    expect(overlayContainer.getContainerElement().textContent).not.toContain('Parto');
  });

  it('should expose animal images from the row action dialog with a Material-styled hidden file picker and enqueue new files', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const imagesServiceMock = createImagesServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    imagesServiceMock.listImages.mockReturnValue(
      of([
        {
          id: 'image-1',
          animalUuid: 'animal-uuid-1',
          operationId: 'image-1',
          fileName: 'vaca-1.jpg',
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
          syncMessage: null,
        },
      ] satisfies AnimalImageItem[]),
    );
    const { fixture } = await configure(
      animalsServiceMock,
      createEventsServiceMock(),
      createReproductionEventsServiceMock(),
      imagesServiceMock,
    );

    const imagesButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Imágenes'),
    ) as HTMLButtonElement;
    imagesButton.click();
    await fixture.whenStable();

    expect(overlayContainer.getContainerElement().textContent).toContain('vaca-1.jpg');

    const imageTrigger = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Seleccionar imágenes'),
    ) as HTMLButtonElement;
    const input = overlayContainer.getContainerElement().querySelector('input[type="file"]') as HTMLInputElement;
    expect(imageTrigger.textContent).toContain('Seleccionar imágenes');
    expect(input.getAttribute('accept')).toBe('image/*');
    expect(input.multiple).toBe(true);
    expect(input.getAttribute('aria-label')).toBe('Seleccionar imágenes del animal');

    const file = new File(['photo'], 'nueva-vaca.png', { type: 'image/png' });
    Object.defineProperty(input, 'files', { value: [file] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const submitButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Guardar imágenes'),
    ) as HTMLButtonElement;
    submitButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(imagesServiceMock.addImages).toHaveBeenCalledWith('animal-uuid-1', [file]);
    expect(fixture.nativeElement.textContent).toContain('Imágenes encoladas. Se disparó la sincronización automática.');
  });

  it('should reject non-image files immediately in the row action image dialog without requiring save', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const imagesServiceMock = createImagesServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    const { fixture } = await configure(
      animalsServiceMock,
      createEventsServiceMock(),
      createReproductionEventsServiceMock(),
      imagesServiceMock,
    );

    const imagesButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Imágenes'),
    ) as HTMLButtonElement;
    imagesButton.click();
    await fixture.whenStable();

    const input = overlayContainer.getContainerElement().querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['texto'], 'notas.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [invalidFile] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    const submitButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Guardar imágenes'),
    ) as HTMLButtonElement;
    expect(overlayContainer.getContainerElement().textContent).toContain('Solo podés seleccionar archivos de imagen.');
    expect(submitButton.disabled).toBe(true);
    submitButton.click();
    await fixture.whenStable();
    expect(imagesServiceMock.addImages).not.toHaveBeenCalled();
  });

  it('should keep valid image previews and reject invalid files immediately when selection is mixed', async () => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => `blob:${(file as File).name}`);
    const animalsServiceMock = createAnimalsServiceMock();
    const imagesServiceMock = createImagesServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    const { fixture } = await configure(
      animalsServiceMock,
      createEventsServiceMock(),
      createReproductionEventsServiceMock(),
      imagesServiceMock,
    );

    const imagesButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Imágenes'),
    ) as HTMLButtonElement;
    imagesButton.click();
    await fixture.whenStable();

    const input = overlayContainer.getContainerElement().querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['foto'], 'vaca.png', { type: 'image/png' });
    const invalidFile = new File(['texto'], 'notas.txt', { type: 'text/plain' });
    Object.defineProperty(input, 'files', { value: [validFile, invalidFile] });
    input.dispatchEvent(new Event('change'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(overlayContainer.getContainerElement().textContent).toContain('Se ignoraron 1 archivo(s) porque no son imágenes.');
    const selectedPreviewImages = overlayContainer.getContainerElement().querySelectorAll('.selected-image-preview img') as NodeListOf<HTMLImageElement>;
    expect(Array.from(selectedPreviewImages).map((image) => image.alt)).toEqual(['vaca.png']);

    const submitButton = Array.from(overlayContainer.getContainerElement().querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Guardar imágenes'),
    ) as HTMLButtonElement;
    submitButton.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(imagesServiceMock.addImages).toHaveBeenCalledWith('animal-uuid-1', [validFile]);
  });

  it('should render animal rows with a first-image thumbnail preview and stronger identity block', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const imagesServiceMock = createImagesServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    imagesServiceMock.listImages.mockReturnValue(
      of([
        {
          id: 'image-1',
          animalUuid: 'animal-uuid-1',
          operationId: 'image-1',
          fileName: 'vaca-1.jpg',
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
          syncMessage: null,
        },
      ] satisfies AnimalImageItem[]),
    );

    const { fixture } = await configure(
      animalsServiceMock,
      createEventsServiceMock(),
      createReproductionEventsServiceMock(),
      imagesServiceMock,
    );

    const thumbnail = fixture.nativeElement.querySelector('.animal-thumbnail img') as HTMLImageElement;
    expect(thumbnail.getAttribute('src')).toBe('blob:image-1');
    expect(thumbnail.getAttribute('alt')).toContain('AR-100');
    expect(fixture.nativeElement.querySelector('.animal-identity__primary')?.textContent).toContain('AR-100');
    expect(fixture.nativeElement.querySelector('.animal-identity__meta')?.textContent).toContain('Marca Sur');
    expect(fixture.nativeElement.textContent).toContain('420 kg');
  });

  it('should render Spanish sync badges for pending, synced and conflict animal rows', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([
      createAnimal({ uuid: 'pending-animal', arete: 'PEND-001', syncStatus: 'pending', syncMessage: 'Pendiente de sync.' }),
      createAnimal({ uuid: 'synced-animal', arete: 'SYNC-001', syncStatus: 'synced' }),
      createAnimal({ uuid: 'conflict-animal', arete: 'CONF-001', syncStatus: 'conflict', syncMessage: 'Versión remota cambió.' }),
    ]));

    const { fixture } = await configure(animalsServiceMock);

    const rowBadges = Array.from(fixture.nativeElement.querySelectorAll('.animal-sync-badge') as NodeListOf<HTMLElement>);
    expect(rowBadges.map((badge) => badge.textContent?.trim())).toEqual([
      'Pendiente',
      'Sincronizado',
      'Conflicto',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Versión remota cambió.');
  });

  it('should mark pending and failed animal thumbnails with visible media badges', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    const imagesServiceMock = createImagesServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([
      createAnimal({ uuid: 'local-image-animal', arete: 'IMG-LOCAL' }),
      createAnimal({ uuid: 'failed-image-animal', arete: 'IMG-FAILED' }),
    ]));
    imagesServiceMock.listImages.mockImplementation((animalUuid: string) => of([
      {
        id: `${animalUuid}-image`,
        animalUuid,
        operationId: `${animalUuid}-operation`,
        fileName: `${animalUuid}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: 1200,
        checksumSha256: 'a'.repeat(64),
        capturedAt: '2026-04-26T10:00:00.000Z',
        sourceChannel: 'OFFLINE',
        binaryRef: `${animalUuid}-binary`,
        previewUrl: `blob:${animalUuid}`,
        clientCreatedAt: '2026-04-26T10:00:00.000Z',
        createdAt: '2026-04-26T10:00:00.000Z',
        updatedAt: '2026-04-26T10:00:00.000Z',
        syncState: animalUuid === 'failed-image-animal' ? 'FAILED' : 'PENDING',
        syncMessage: animalUuid === 'failed-image-animal' ? 'No se pudo subir.' : 'Pendiente de sync.',
        uiStatus: animalUuid === 'failed-image-animal' ? 'failed' : 'local_only',
      },
    ] satisfies AnimalImageItem[]));

    const { fixture } = await configure(
      animalsServiceMock,
      createEventsServiceMock(),
      createReproductionEventsServiceMock(),
      imagesServiceMock,
    );

    const thumbnailBadges = Array.from(fixture.nativeElement.querySelectorAll('.animal-thumbnail__sync') as NodeListOf<HTMLElement>);
    expect(thumbnailBadges.map((badge) => badge.textContent?.trim())).toEqual(['Solo local', 'Error']);
  });

  it('should render a clear livestock placeholder when an animal has no images', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal({ uuid: 'animal-without-image' })]));
    const { fixture } = await configure(animalsServiceMock);

    const placeholder = fixture.nativeElement.querySelector('.animal-thumbnail--placeholder');
    expect(placeholder).not.toBeNull();
    expect(placeholder.textContent).toContain('pets');
    expect(placeholder.getAttribute('aria-label')).toBe('Sin foto del animal');
  });
});
