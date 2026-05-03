import { OverlayContainer } from '@angular/cdk/overlay';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AnimalsPageComponent } from './animals-page.component';
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
    listImages: vi.fn(() => of([] as AnimalImageItem[])),
    addImages: vi.fn(() => of({ outcome: 'queued', message: 'Imágenes encoladas. Se disparó la sincronización automática.' })),
  });

  const configure = async (
    animalsServiceMock = createAnimalsServiceMock(),
    eventsServiceMock = createEventsServiceMock(),
    reproductionEventsServiceMock = createReproductionEventsServiceMock(),
    imagesServiceMock = createImagesServiceMock(),
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
        { provide: OfflineStatusService, useValue: { message: signal(null) } },
      ],
    }).compileComponents();

    overlayContainer = TestBed.inject(OverlayContainer);
    const fixture = TestBed.createComponent(AnimalsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return {
      fixture,
      component: fixture.componentInstance,
      animalsServiceMock,
      eventsServiceMock,
      reproductionEventsServiceMock,
      imagesServiceMock,
    };
  };

  it('should render the animals data table with the sex column and without legacy global filters', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal()]));
    const { fixture } = await configure(animalsServiceMock);

    expect(fixture.nativeElement.textContent).toContain('Animales');
    expect(fixture.nativeElement.textContent).toContain('Sexo');
    expect(fixture.nativeElement.textContent).toContain('HEMBRA');
    expect(fixture.nativeElement.textContent).toContain('AR-100');
    expect(fixture.nativeElement.textContent).not.toContain('UUID owner actual');
    expect(fixture.nativeElement.textContent).not.toContain('Estado operativo');
  });

  it('should open the create dialog from the toolbar button', async () => {
    const { fixture } = await configure();

    const createButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Nuevo animal'),
    ) as HTMLButtonElement;
    createButton.click();
    await fixture.whenStable();

    expect(overlayContainer.getContainerElement().textContent).toContain('Nuevo animal');
    expect(overlayContainer.getContainerElement().textContent).toContain('Fecha de nacimiento');
  });

  it('should open the edit dialog pre-populated from the row action', async () => {
    const animalsServiceMock = createAnimalsServiceMock();
    animalsServiceMock.listAnimals.mockReturnValue(of([createAnimal({ category: ANIMAL_CATEGORY.TERNERA, sex: ANIMAL_SEX.HEMBRA })]));
    const { fixture } = await configure(animalsServiceMock);

    const editButton = Array.from(fixture.nativeElement.querySelectorAll('button')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Ver/Editar ficha'),
    ) as HTMLButtonElement;
    editButton.click();
    await fixture.whenStable();

    const overlayText = overlayContainer.getContainerElement().textContent ?? '';
    expect(overlayText).toContain('Editar animal');
    const dialogInputs = Array.from(overlayContainer.getContainerElement().querySelectorAll('input')) as HTMLInputElement[];
    expect(dialogInputs.some((input) => input.value === 'ganadero-uuid-1')).toBe(true);
    expect(dialogInputs.some((input) => input.value === 'AR-100')).toBe(true);
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

  it('should expose animal images from the row action dialog and enqueue new files', async () => {
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

    const input = overlayContainer.getContainerElement().querySelector('input[type="file"]') as HTMLInputElement;
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
});
