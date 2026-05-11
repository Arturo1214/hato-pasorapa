import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { of } from 'rxjs';
import { AnimalsService, ANIMAL_CATEGORY, ANIMAL_SEX, type AnimalItem } from '../animals/data-access/animals.service';
import { VetVisitFormDialogComponent, type VetVisitDialogData, type VetVisitDialogResult } from './vet-visit-form-dialog.component';

describe('VetVisitFormDialogComponent', () => {
  const dialogRef = { close: vi.fn() };
  const createAnimal = (overrides: Partial<AnimalItem> = {}): AnimalItem => ({
    uuid: 'animal-1',
    ownerGanaderoId: 'ganadero-1',
    arete: 'AR-001',
    marca: null,
    tatuaje: null,
    color: null,
    description: null,
    breedUuid: null,
    breedName: null,
    category: ANIMAL_CATEGORY.VACA,
    sex: ANIMAL_SEX.HEMBRA,
    active: true,
    admissionDate: '2026-01-01',
    weightKg: null,
    createdAt: '2026-05-01T10:00:00Z',
    updatedAt: '2026-05-01T10:00:00Z',
    version: 1,
    lastSyncedAt: null,
    ...overrides,
  });

  const configure = async (animals = [createAnimal()], data: VetVisitDialogData = {}) => {
    dialogRef.close.mockClear();
    await TestBed.configureTestingModule({
      imports: [VetVisitFormDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: AnimalsService, useValue: { listAnimals: vi.fn(() => of(animals)) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VetVisitFormDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should hide animal requirement in global mode and close with veterinarian visit metadata', async () => {
    const { component, fixture } = await configure();

    component.form.patchValue({
      mode: 'GLOBAL',
      animalUuid: null,
      veterinarianName: ' Dra. Luna ',
      veterinarianLicense: ' MV-001 ',
      notes: ' Control de rodeo ',
      reason: 'Campaña',
    });
    component.submit();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'GLOBAL',
        animalUuid: null,
        veterinarianName: 'Dra. Luna',
        veterinarianLicense: 'MV-001',
        status: 'PENDING',
      } satisfies Partial<VetVisitDialogResult>),
    );
  });

  it('should use Material datepicker controls for visit dates', async () => {
    const { fixture } = await configure();

    expect(fixture.nativeElement.querySelectorAll('mat-datepicker-toggle')).toHaveLength(2);
    expect(fixture.nativeElement.textContent).toContain('Fecha de visita');
    expect(fixture.nativeElement.textContent).toContain('Próximo control');
  });

  it('should offer only Programada and Atendida as initial statuses in the new visit form', async () => {
    const { fixture, component } = await configure();

    expect(component.initialStatusOptions.map((option) => option.label)).toEqual(['Programada', 'Atendida']);
    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Programada');
    expect(text).toContain('Atendida');
    expect(text).not.toContain('Reprogramada');
    expect(text).not.toContain('Finalizada');
    expect(text).not.toContain('Cancelada');
  });

  it('should require only motive for scheduled visits and attention notes for attended visits', async () => {
    const { component } = await configure([], { mode: 'GLOBAL' });

    component.form.patchValue({
      mode: 'GLOBAL',
      status: 'PENDING',
      veterinarianName: 'Dra. Luna',
      reason: 'Campaña de control',
      notes: '',
    });
    expect(component.form.valid).toBe(true);

    component.form.patchValue({ status: 'ATTENDED', notes: '' });
    expect(component.form.valid).toBe(false);

    component.form.patchValue({ notes: 'Se aplicó tratamiento inmediato.' });
    expect(component.form.valid).toBe(true);
  });

  it('should not show redundant Hallazgos or Plan fields in the initial visit form', async () => {
    const { fixture } = await configure();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Motivo');
    expect(text).not.toContain('Hallazgos');
    expect(text).not.toContain('Plan');
  });

  it('should require an animal in specific mode with an explicit Spanish validation message', async () => {
    const { component, fixture } = await configure();

    component.form.patchValue({ mode: 'SPECIFIC', animalUuid: null, veterinarianName: 'Dra. Luna' });
    component.submit();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Seleccioná el animal de la visita específica.');
  });

  it('should show latest 10 active animals by default and filter autocomplete by arete, marca, or tatuaje', async () => {
    const animals = Array.from({ length: 12 }, (_, index) =>
      createAnimal({
        uuid: `animal-${index + 1}`,
        arete: `AR-${index + 1}`,
        marca: index === 10 ? 'Marca Norte' : null,
        tatuaje: index === 11 ? 'TAT-12' : null,
        updatedAt: `2026-05-${String(index + 1).padStart(2, '0')}T10:00:00Z`,
      }),
    );
    const { component } = await configure(animals);

    expect(component.animalOptions()).toHaveLength(10);
    expect(component.animalOptions()[0].uuid).toBe('animal-12');

    component.form.controls.animalSearch.setValue('marca norte');
    expect(component.animalOptions().map((animal) => animal.uuid)).toEqual(['animal-11']);

    component.form.controls.animalSearch.setValue('tat-12');
    expect(component.animalOptions().map((animal) => animal.uuid)).toEqual(['animal-12']);
  });
});
