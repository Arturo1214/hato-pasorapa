import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AnimalsPageComponent } from './animals-page.component';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import { AnimalsHealthEventsService, type AnimalHealthEventItem } from './data-access/animals-health-events.service';
import { AnimalsReproductionEventsService, type AnimalReproductionEventItem } from './data-access/animals-reproduction-events.service';
import { AnimalsService, type AnimalItem, type AnimalListFilters, type AnimalsSyncState } from './data-access/animals.service';
import { AnimalsEventsService, type AnimalEventItem } from './data-access/animals-events.service';

describe('AnimalsPageComponent', () => {
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'ganadero-uuid-1',
    arete: 'AR-100',
    marca: null,
    tatuaje: null,
    category: 'COW',
    active: true,
    admissionDate: '2026-04-26',
    weightKg: 420,
    createdAt: '2026-04-26T10:00:00',
     version: 1,
     updatedAt: '2026-04-26T10:00:00',
     lastSyncedAt: '2026-04-26T10:05:00',
     motherAnimalUuid: null,
     fatherAnimalUuid: null,
     birthDate: null,
     ...overrides,
   });

  const createServiceMock = () => ({
    listAnimals: vi.fn(() => of([] as AnimalItem[])),
    createAnimal: vi.fn(() => of({ outcome: 'synced', message: 'Ficha animal registrada correctamente.' })),
    updateAnimal: vi.fn(() => of({ outcome: 'synced', message: 'Ficha animal actualizada correctamente.' })),
    syncState: signal<AnimalsSyncState>({
      pending: 0,
      syncing: false,
      lastSyncAt: null,
      lastMessage: null,
      manualRefreshRequired: false,
    }),
  });

  const createEventsServiceMock = () => ({
    listEvents: vi.fn(() => of([] as AnimalEventItem[])),
    createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento animal encolado. Se disparó la sincronización automática.' })),
  });

  const createImagesServiceMock = () => ({
    listImages: vi.fn(() => of([] as AnimalImageItem[])),
    addImages: vi.fn(() => of({ outcome: 'queued', message: 'Imágenes encoladas. Se enviarán al reconectar.' })),
  });

  const createHealthEventsServiceMock = () => ({
    listEvents: vi.fn(() => of([] as AnimalHealthEventItem[])),
    createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento sanitario encolado. Se disparó la sincronización automática.' })),
  });

  const createReproductionEventsServiceMock = () => ({
    listEvents: vi.fn(() => of([] as AnimalReproductionEventItem[])),
    createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento reproductivo encolado. Se disparó la sincronización automática.' })),
  });

  const configure = async (
    serviceMock: ReturnType<typeof createServiceMock>,
    imagesServiceMock = createImagesServiceMock(),
    eventsServiceMock = createEventsServiceMock(),
    healthEventsServiceMock = createHealthEventsServiceMock(),
    reproductionEventsServiceMock = createReproductionEventsServiceMock()
  ) => {
    await TestBed.configureTestingModule({
      imports: [AnimalsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AnimalsService,
          useValue: serviceMock,
        },
        {
          provide: AnimalsImagesService,
          useValue: imagesServiceMock,
        },
        {
          provide: AnimalsEventsService,
          useValue: eventsServiceMock,
        },
        {
          provide: AnimalsHealthEventsService,
          useValue: healthEventsServiceMock,
        },
        {
          provide: AnimalsReproductionEventsService,
          useValue: reproductionEventsServiceMock,
        },
        {
          provide: OfflineStatusService,
          useValue: {
            message: signal(null),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalsPageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, imagesServiceMock, eventsServiceMock, healthEventsServiceMock, reproductionEventsServiceMock };
  };

  it('should show explicit validation messages for owner and visible identifiers', async () => {
    const { fixture, component } = await configure(createServiceMock());

    component.submitForm();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Informá el UUID del ganadero responsable.');
    expect(fixture.nativeElement.textContent).toContain(
      'Indicá al menos un identificador visible: arete, marca o tatuaje.'
    );
  });

  it('should keep the save button disabled until the animal form is minimally valid', async () => {
    const { fixture, component } = await configure(createServiceMock());

    const submitButton = Array.from(fixture.nativeElement.querySelectorAll('button[type="submit"]')).find((button) =>
      (button as HTMLButtonElement).textContent?.includes('Registrar animal')
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);

    component.form.patchValue({
      ownerGanaderoId: 'ganadero-uuid-1',
      arete: 'AR-100',
      category: 'COW',
      active: true,
      admissionDate: '2026-04-26',
      weightKg: 420,
    });
    fixture.detectChanges();

    expect(submitButton.disabled).toBe(false);
  });

  it('should switch to edit mode and submit updates by animal uuid', async () => {
    const serviceMock = createServiceMock();
    const animal = createAnimal();
    serviceMock.listAnimals.mockReturnValue(of([animal]));
    const { fixture, component } = await configure(serviceMock);

    component.startEdit(animal);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Editando ficha animal');

    component.form.patchValue({ arete: 'AR-101' });
    component.submitForm();
    fixture.detectChanges();

    expect(serviceMock.updateAnimal).toHaveBeenCalledWith(
      animal.uuid,
      expect.objectContaining({ ownerGanaderoId: 'ganadero-uuid-1', arete: 'AR-101' })
    );
    expect(fixture.nativeElement.textContent).toContain('Ficha animal actualizada correctamente.');
  });

  it('should show an empty state when there are no animals loaded yet', async () => {
    const { fixture } = await configure(createServiceMock());

    expect(fixture.nativeElement.textContent).toContain('Todavía no hay animales registrados.');
  });

  it('should bind operational filters to the service and show sync markers in the listing', async () => {
    const serviceMock = createServiceMock();
    const pendingAnimal = createAnimal({ syncStatus: 'pending', syncMessage: 'Pendiente de sync.' });
    serviceMock.listAnimals.mockImplementation((filters?: AnimalListFilters) =>
      of(filters?.visible ? [pendingAnimal] : [createAnimal({ uuid: 'animal-uuid-2', arete: 'AR-200' }), pendingAnimal])
    );

    const { fixture, component } = await configure(serviceMock);

    component.filtersForm.patchValue({
      visible: 'AR-100',
      ownerGanaderoId: 'ganadero-uuid-1',
      active: 'true',
      category: 'COW',
    });
    component.applyFilters();
    fixture.detectChanges();

    expect(serviceMock.listAnimals).toHaveBeenLastCalledWith({
      visible: 'AR-100',
      ownerGanaderoId: 'ganadero-uuid-1',
      active: true,
      category: 'COW',
    });
    expect(fixture.nativeElement.textContent).toContain('Pendiente de sync.');
  });

  it('should render minimal per-animal history and queue animal events from the selected card', async () => {
    const serviceMock = createServiceMock();
    const eventsServiceMock = createEventsServiceMock();
    const healthEventsServiceMock = createHealthEventsServiceMock();
    const reproductionEventsServiceMock = createReproductionEventsServiceMock();
    const animal = createAnimal();
    serviceMock.listAnimals.mockReturnValue(of([animal]));
    eventsServiceMock.listEvents.mockReturnValue(
      of([
        {
          id: 'event-1',
          animalUuid: animal.uuid,
          type: 'OBSERVATION',
          occurredAt: '2026-04-26T10:00:00.000Z',
          notes: 'Observación estable',
          performedByUserId: 'user-1',
          sourceChannel: 'ONLINE',
          operationId: 'event-1',
          metadata: { reasonCode: 'GENERAL_NOTE' },
          clientCreatedAt: '2026-04-26T10:00:00.000Z',
          createdAt: '2026-04-26T10:00:01.000Z',
          updatedAt: '2026-04-26T10:00:01.000Z',
          syncStatus: 'synced',
          syncMessage: null,
        },
      ])
    );
    healthEventsServiceMock.listEvents.mockReturnValue(
      of([
        {
          id: 'health-event-1',
          animalUuid: animal.uuid,
          healthEventType: 'TREATMENT_STARTED',
          occurredAt: '2026-04-26T11:00:00.000Z',
          notes: 'Tratamiento activo',
          performedByUserId: 'user-1',
          sourceChannel: 'ONLINE',
          operationId: 'health-event-1',
          metadata: { treatmentCaseId: 'CASE-1', productName: 'Oxitetraciclina' },
          clientCreatedAt: '2026-04-26T11:00:00.000Z',
          createdAt: '2026-04-26T11:00:01.000Z',
          updatedAt: '2026-04-26T11:00:01.000Z',
          syncStatus: 'synced',
          syncMessage: null,
          treatmentStatus: 'active',
        },
      ])
    );
    reproductionEventsServiceMock.listEvents.mockReturnValue(
      of([
        {
          id: 'repro-event-1',
          animalUuid: animal.uuid,
          reproductionEventType: 'BIRTH',
          occurredAt: '2026-04-26T12:00:00.000Z',
          notes: 'Parto controlado',
          performedByUserId: 'user-1',
          sourceChannel: 'ONLINE',
          operationId: 'repro-event-1',
          metadata: { birthDate: '2026-04-26T12:00:00.000Z', offspringCount: 1, motherAnimalUuid: animal.uuid },
          clientCreatedAt: '2026-04-26T12:00:00.000Z',
          createdAt: '2026-04-26T12:00:01.000Z',
          updatedAt: '2026-04-26T12:00:01.000Z',
          syncStatus: 'synced',
          syncState: 'SYNCED',
          syncMessage: null,
        },
      ])
    );
    const { fixture, component } = await configure(
      serviceMock,
      createImagesServiceMock(),
      eventsServiceMock,
      healthEventsServiceMock,
      reproductionEventsServiceMock
    );
    await fixture.whenStable();
    fixture.detectChanges();

    component.selectAnimalForEvent(animal);
    component.eventForm.patchValue({
      type: 'TRANSFERRED',
      occurredAt: '2026-04-26T12:00',
      notes: 'Cambio de propietario',
      fromOwnerGanaderoId: 'ganadero-uuid-1',
      toOwnerGanaderoId: 'ganadero-uuid-2',
    });
    component.submitEventForm();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(eventsServiceMock.listEvents).toHaveBeenCalledWith(animal.uuid, {});
    expect(eventsServiceMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        animalUuid: animal.uuid,
        type: 'TRANSFERRED',
        metadata: expect.objectContaining({
          fromOwnerGanaderoId: 'ganadero-uuid-1',
          toOwnerGanaderoId: 'ganadero-uuid-2',
        }),
      })
    );
    expect(fixture.nativeElement.textContent).toContain('Observación estable');
    expect(fixture.nativeElement.textContent).toContain('Tratamiento activo');
    expect(fixture.nativeElement.textContent).toContain('Parto controlado');
    expect(fixture.nativeElement.textContent).toContain('Evento animal encolado. Se disparó la sincronización automática.');
  });

  it('should expose a dedicated veterinary navigation entry from the selected animal card', async () => {
    const serviceMock = createServiceMock();
    const animal = createAnimal();
    serviceMock.listAnimals.mockReturnValue(of([animal]));
    const { fixture } = await configure(serviceMock);
    await fixture.whenStable();
    fixture.detectChanges();

    const link = Array.from(fixture.nativeElement.querySelectorAll('a')).find((element) =>
      (element as HTMLAnchorElement).textContent?.includes('Abrir visitas veterinarias')
    ) as HTMLAnchorElement;

    expect(link).toBeTruthy();
    expect(fixture.nativeElement.textContent).toContain('Abrir visitas veterinarias');
  });

  it('should queue a birth event with mandatory offspring linkage from the selected card', async () => {
    const serviceMock = createServiceMock();
    const animal = createAnimal();
    serviceMock.listAnimals.mockReturnValue(of([animal]));
    const { fixture, component, reproductionEventsServiceMock } = await configure(serviceMock);
    await fixture.whenStable();

    component.selectAnimalForReproductionEvent(animal);
    component.reproductionEventForm.patchValue({
      reproductionEventType: 'BIRTH',
      occurredAt: '2026-04-26T13:00',
      notes: 'Parto gemelar',
      birthDate: '2026-04-26T13:00',
      motherAnimalUuid: animal.uuid,
      fatherAnimalUuid: 'animal-father-1',
      offspringCount: 2,
      offspringAnimalUuids: 'calf-1, calf-2',
    });
    component.submitReproductionEventForm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(reproductionEventsServiceMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        animalUuid: animal.uuid,
        reproductionEventType: 'BIRTH',
        metadata: expect.objectContaining({
          offspringCount: 2,
          motherAnimalUuid: animal.uuid,
          fatherAnimalUuid: 'animal-father-1',
          offspringAnimalUuids: ['calf-1', 'calf-2'],
        }),
      })
    );
    expect(fixture.nativeElement.textContent).toContain('Evento reproductivo encolado. Se disparó la sincronización automática.');
  });

  it('should queue multiple animal images and render their basic timeline', async () => {
    const serviceMock = createServiceMock();
    const imagesServiceMock = createImagesServiceMock();
    const animal = createAnimal();
    serviceMock.listAnimals.mockReturnValue(of([animal]));
    imagesServiceMock.listImages.mockReturnValue(
      of([
        {
          id: 'image-1',
          animalUuid: animal.uuid,
          operationId: 'image-1',
          fileName: 'vaca-1.jpg',
          mimeType: 'image/jpeg',
          sizeBytes: 1234,
          checksumSha256: 'a'.repeat(64),
          capturedAt: '2026-04-26T10:00:00.000Z',
          sourceChannel: 'OFFLINE',
          binaryRef: 'image-1',
          previewUrl: 'blob:image-1',
          clientCreatedAt: '2026-04-26T10:00:00.000Z',
          createdAt: '2026-04-26T10:00:00.000Z',
          updatedAt: '2026-04-26T10:00:00.000Z',
          syncState: 'PENDING',
          syncMessage: 'Pendiente de sync.',
        },
      ])
    );

    const { fixture, component } = await configure(serviceMock, imagesServiceMock);
    await fixture.whenStable();
    fixture.detectChanges();

    const fileA = new File(['a'], 'vaca-a.jpg', { type: 'image/jpeg' });
    const fileB = new File(['b'], 'vaca-b.png', { type: 'image/png' });
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', {
      value: [fileA, fileB],
    });

    component.onAnimalImagesSelected(animal, { target: input } as unknown as Event);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(imagesServiceMock.addImages).toHaveBeenCalledWith(animal.uuid, [fileA, fileB]);
    expect(fixture.nativeElement.textContent).toContain('vaca-1.jpg');
    expect(fixture.nativeElement.textContent).toContain('PENDING');
  });
});
