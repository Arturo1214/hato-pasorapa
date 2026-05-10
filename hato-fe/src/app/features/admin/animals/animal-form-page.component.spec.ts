import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import { ANIMAL_CATEGORY, ANIMAL_SEX, AnimalsService, type AnimalItem } from './data-access/animals.service';
import { GanaderosService } from '../ganaderos/data-access/ganaderos.service';
import { AnimalFormPageComponent } from './animal-form-page.component';

describe('AnimalFormPageComponent', () => {
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-uuid-1',
    ownerGanaderoId: 'ganadero-uuid-1',
    motherAnimalUuid: null,
    fatherAnimalUuid: null,
    arete: 'CRIA-001',
    marca: null,
    tatuaje: null,
    category: ANIMAL_CATEGORY.TERNERA,
    sex: ANIMAL_SEX.HEMBRA,
    active: true,
    birthDate: '2026-01-01',
    admissionDate: '2026-01-02',
    weightKg: 90,
    createdAt: '2026-01-02T10:00:00.000Z',
    version: 1,
    updatedAt: '2026-01-02T10:00:00.000Z',
    lastSyncedAt: null,
    ...overrides,
  });

  const configure = async (options: { uuid?: string | null; animals?: AnimalItem[]; images?: AnimalImageItem[]; role?: 'ADMIN' | 'GANADERO' } = {}) => {
    const animals = options.animals ?? [
      createAnimal({ uuid: 'mother-uuid', arete: 'MADRE-001', category: ANIMAL_CATEGORY.VACA, sex: ANIMAL_SEX.HEMBRA }),
      createAnimal({ uuid: 'father-uuid', arete: 'PADRE-001', category: ANIMAL_CATEGORY.TORO, sex: ANIMAL_SEX.MACHO }),
      createAnimal({ uuid: 'animal-uuid-1', motherAnimalUuid: 'mother-uuid', fatherAnimalUuid: 'father-uuid' }),
    ];
    const animalsService = {
      listAnimals: vi.fn(() => of(animals)),
      getAnimal: vi.fn(() => of(animals[2])),
      createAnimal: vi.fn(() => of({ outcome: 'queued', animalUuid: 'created-animal-uuid', message: 'Alta de animal encolada.' })),
      updateAnimal: vi.fn(() => of({ outcome: 'queued', message: 'Actualización de animal encolada.' })),
    };
    const router = { navigateByUrl: vi.fn().mockResolvedValue(true) };

    await TestBed.configureTestingModule({
      imports: [AnimalFormPageComponent],
      providers: [
        provideNoopAnimations(),
        { provide: AnimalsService, useValue: animalsService },
        { provide: AnimalsImagesService, useValue: { listImages: vi.fn(() => of(options.images ?? [])) } },
        { provide: GanaderosService, useValue: { listGanaderos: vi.fn(() => of([{ id: 'ganadero-uuid-1', name: 'Ganadero Uno', businessIdentifier: 'NIT-1' }])) } },
        { provide: AuthService, useValue: { currentUser: () => ({ role: options.role ?? 'ADMIN', status: 'ACTIVE' }) } },
        { provide: Router, useValue: router },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => options.uuid ?? null }, routeConfig: { path: options.uuid ? 'admin/animales/:uuid/editar' : 'admin/animales/nuevo' } } } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AnimalFormPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, animalsService, router };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should render create mode with image-after-save note and parent selectors', async () => {
    const { fixture } = await configure({ uuid: null });

    expect(fixture.nativeElement.textContent).toContain('Podrás agregar imágenes después de guardar');
    expect(fixture.nativeElement.textContent).toContain('Madre');
    expect(fixture.nativeElement.textContent).toContain('Padre');
    expect(fixture.nativeElement.textContent).toContain('MADRE-001');
    expect(fixture.nativeElement.textContent).toContain('PADRE-001');
    expect(fixture.nativeElement.textContent).not.toContain('UUID del ganadero dueño');
  });

  it('should load edit mode, preserve selected parents and navigate to detail after save', async () => {
    const { component, animalsService, router } = await configure({ uuid: 'animal-uuid-1' });

    expect(component.form.controls.motherAnimalUuid.value).toBe('mother-uuid');
    expect(component.form.controls.fatherAnimalUuid.value).toBe('father-uuid');

    component.submit();

    expect(animalsService.updateAnimal).toHaveBeenCalledWith('animal-uuid-1', expect.objectContaining({
      motherAnimalUuid: 'mother-uuid',
      fatherAnimalUuid: 'father-uuid',
    }));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/animales/animal-uuid-1');
  });

  it('should navigate admin creates to the newly queued animal detail uuid', async () => {
    const { component, animalsService, router } = await configure({ uuid: null });

    component.form.patchValue({
      ownerGanaderoId: 'ganadero-uuid-1',
      arete: 'CRIA-002',
      category: ANIMAL_CATEGORY.TERNERA,
      sex: ANIMAL_SEX.HEMBRA,
      birthDate: '2026-01-01',
      admissionDate: '2026-01-02',
    });
    component.submit();

    expect(animalsService.createAnimal).toHaveBeenCalledWith(expect.objectContaining({ arete: 'CRIA-002' }));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin/animales/created-animal-uuid');
  });

  it('should navigate ganadero creates to the newly queued animal detail uuid', async () => {
    const { component, router } = await configure({ uuid: null, role: 'GANADERO' });

    component.form.patchValue({
      arete: 'CRIA-003',
      category: ANIMAL_CATEGORY.TERNERA,
      sex: ANIMAL_SEX.HEMBRA,
      birthDate: '2026-01-01',
      admissionDate: '2026-01-02',
    });
    component.submit();

    expect(router.navigateByUrl).toHaveBeenCalledWith('/ganadero/animales/created-animal-uuid');
  });
});
