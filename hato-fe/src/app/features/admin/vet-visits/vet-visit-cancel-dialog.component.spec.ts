import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { VetVisitCancelDialogComponent } from './vet-visit-cancel-dialog.component';

describe('VetVisitCancelDialogComponent', () => {
  const dialogRef = { close: vi.fn() };

  const configure = async () => {
    dialogRef.close.mockClear();
    await TestBed.configureTestingModule({
      imports: [VetVisitCancelDialogComponent],
      providers: [provideNoopAnimations(), { provide: MatDialogRef, useValue: dialogRef }],
    }).compileComponents();

    const fixture = TestBed.createComponent(VetVisitCancelDialogComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should render a Spanish cancellation reason textarea with disabled confirm until valid', async () => {
    const { fixture, component } = await configure();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Cancelar visita');
    expect(text).toContain('Motivo de cancelación');
    expect(fixture.nativeElement.querySelector('textarea[formControlName="cancelReason"]')).not.toBeNull();

    component.form.controls.cancelReason.setValue('No');
    component.form.controls.cancelReason.markAsTouched();
    fixture.detectChanges();

    expect(component.form.valid).toBe(false);
    expect(text).toContain('Confirmar cancelación');
    expect(fixture.nativeElement.textContent).toContain('Ingresá al menos 5 caracteres.');
    expect(fixture.nativeElement.querySelector('button[color="warn"]').disabled).toBe(true);
  });

  it('should close with a trimmed cancellation reason on confirm and null on cancel', async () => {
    const { component } = await configure();

    component.form.controls.cancelReason.setValue('  El animal fue vendido  ');
    component.confirm();

    expect(dialogRef.close).toHaveBeenCalledWith({ cancelReason: 'El animal fue vendido' });

    dialogRef.close.mockClear();
    component.cancel();

    expect(dialogRef.close).toHaveBeenCalledWith(null);
  });
});
