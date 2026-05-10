import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ANIMAL_DIALOG_MODE, AnimalFormDialogComponent } from './animal-form-dialog.component';
import { ANIMAL_CATEGORY, ANIMAL_SEX } from './data-access/animals.service';

describe('AnimalFormDialogComponent', () => {
  let fixture: ComponentFixture<AnimalFormDialogComponent>;
  let component: AnimalFormDialogComponent;
  const dialogRef = { close: vi.fn() };

  const configure = async (data: object) => {
    await TestBed.configureTestingModule({
      imports: [AnimalFormDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AnimalFormDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  };

  afterEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
  });

  it('should render the birthDate field and submit a valid create payload', async () => {
    await configure({
      mode: ANIMAL_DIALOG_MODE.CREATE,
      currentUserRole: 'ADMIN',
      ownerOptions: [{ id: 'ganadero-uuid-1', label: 'Ganadero Uno · NIT-1' }],
    });

    component.form.patchValue({
      ownerGanaderoId: 'ganadero-uuid-1',
      arete: 'AR-100',
      category: ANIMAL_CATEGORY.TERNERA,
      sex: ANIMAL_SEX.HEMBRA,
      active: true,
      birthDate: '2025-10-26',
      admissionDate: '2026-04-26',
      weightKg: 380,
    });
    component.submit();

    expect(fixture.nativeElement.textContent).toContain('Fecha de nacimiento');
    expect(dialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({
        category: ANIMAL_CATEGORY.TERNERA,
        sex: ANIMAL_SEX.HEMBRA,
        birthDate: '2025-10-26',
      }),
    );
  });

  it('should show validation errors when category and sex are incompatible', async () => {
    await configure({
      mode: ANIMAL_DIALOG_MODE.CREATE,
      currentUserRole: 'ADMIN',
      ownerOptions: [{ id: 'ganadero-uuid-1', label: 'Ganadero Uno · NIT-1' }],
    });

    component.form.patchValue({
      ownerGanaderoId: 'ganadero-uuid-1',
      arete: 'AR-100',
      category: ANIMAL_CATEGORY.VACA,
      sex: ANIMAL_SEX.MACHO,
      active: true,
      admissionDate: '2026-04-26',
    });
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('La categoría seleccionada no es compatible con el sexo informado.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should require birthDate for young animals in edit mode', async () => {
    await configure({
      mode: ANIMAL_DIALOG_MODE.EDIT,
      currentUserRole: 'ADMIN',
      ownerOptions: [{ id: 'ganadero-uuid-1', label: 'Ganadero Uno · NIT-1' }],
      animal: {
        uuid: 'animal-uuid-1',
        ownerGanaderoId: 'ganadero-uuid-1',
        motherAnimalUuid: null,
        fatherAnimalUuid: null,
        arete: 'AR-100',
        marca: null,
        tatuaje: null,
        category: ANIMAL_CATEGORY.TERNERO,
        sex: ANIMAL_SEX.MACHO,
        active: true,
        birthDate: null,
        admissionDate: '2026-04-26',
        weightKg: 240,
        createdAt: '2026-04-26T10:00:00.000Z',
        version: 1,
        updatedAt: '2026-04-26T10:00:00.000Z',
        lastSyncedAt: null,
      },
    });

    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá la fecha de nacimiento para terneros/as.');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('should hide the owner selector for ganadero and omit raw UUID typing', async () => {
    await configure({
      mode: ANIMAL_DIALOG_MODE.CREATE,
      currentUserRole: 'GANADERO',
      ownerOptions: [],
    });

    component.form.patchValue({
      arete: 'AR-200',
      category: ANIMAL_CATEGORY.VACA,
      sex: ANIMAL_SEX.HEMBRA,
      active: true,
      admissionDate: '2026-04-26',
    });
    component.submit();

    expect(fixture.nativeElement.textContent).toContain('El propietario se asignará automáticamente con tu sesión de ganadero.');
    expect(fixture.nativeElement.textContent).not.toContain('UUID del ganadero dueño');
    expect(dialogRef.close).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerGanaderoId: null,
      }),
    );
  });
});
