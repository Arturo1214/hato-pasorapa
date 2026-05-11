import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { RAZA_DIALOG_MODE, RazaFormDialogComponent, type RazaDialogData, type RazaDialogResult } from './raza-form-dialog.component';

describe('RazaFormDialogComponent', () => {
  const dialogRef = { close: vi.fn() };

  const configure = async (data: RazaDialogData = { mode: RAZA_DIALOG_MODE.CREATE }) => {
    dialogRef.close.mockClear();
    await TestBed.configureTestingModule({
      imports: [RazaFormDialogComponent],
      providers: [
        provideNoopAnimations(),
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RazaFormDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should require nombre with an explicit Spanish validation message', async () => {
    const { fixture, component } = await configure();

    component.form.controls.nombre.setValue('');
    component.submit();
    fixture.detectChanges();

    expect(dialogRef.close).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Ingresá el nombre de la raza.');
  });

  it('should close with trimmed create payload and active true by default', async () => {
    const { component } = await configure();

    component.form.setValue({
      nombre: '  Brangus  ',
      descripcion: '  Cruza productiva  ',
      origen: '  Bolivia  ',
      sortOrder: 2,
      tipo: 'UNCLASSIFIED',
      activo: true,
    });
    component.submit();

    expect(dialogRef.close).toHaveBeenCalledWith({
      nombre: 'Brangus',
      descripcion: 'Cruza productiva',
      origen: 'Bolivia',
      sortOrder: 2,
      tipo: 'UNCLASSIFIED',
      activo: true,
    } satisfies RazaDialogResult);
  });

  it('should prefill edit data and allow deactivation from the form', async () => {
    const { fixture, component } = await configure({
      mode: RAZA_DIALOG_MODE.EDIT,
      raza: {
        uuid: 'raza-1',
        nombre: 'Criolla',
        descripcion: 'Local',
        origen: 'Bolivia',
        tipo: 'UNCLASSIFIED',
        activo: true,
        sortOrder: 1,
        version: 1,
        createdAt: '2026-05-10T10:00:00',
        updatedAt: '2026-05-10T10:00:00',
      },
    });

    component.form.controls.activo.setValue(false);
    component.submit();
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Criolla', activo: false }));
  });
});
