import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';

export interface VetVisitCancelDialogResult {
  cancelReason: string;
}

@Component({
  selector: 'app-vet-visit-cancel-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, FormErrorsComponent],
  template: `
    <h2 mat-dialog-title>Cancelar visita</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="cancel-form">
        <mat-form-field appearance="outline" class="cancel-form__field">
          <mat-label>Motivo de cancelación</mat-label>
          <textarea matInput formControlName="cancelReason" rows="4" placeholder="Explicá por qué se cancela la visita"></textarea>
          <mat-hint>Mínimo 5 caracteres.</mat-hint>
        </mat-form-field>
        <app-form-errors [control]="form.controls.cancelReason" [messages]="messages.cancelReason" />
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="cancel()">Volver</button>
      <button mat-flat-button color="warn" type="button" [disabled]="form.invalid" (click)="confirm()">Confirmar cancelación</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .cancel-form { padding-top: .5rem; width: min(32rem, 100%); }
      .cancel-form__field { width: 100%; }
    `,
  ],
})
export class VetVisitCancelDialogComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly dialogRef = inject(MatDialogRef<VetVisitCancelDialogComponent, VetVisitCancelDialogResult | null>);

  readonly form = this.formBuilder.group({
    cancelReason: ['', [Validators.required, Validators.minLength(5)]],
  });

  readonly messages = {
    cancelReason: {
      required: 'Ingresá el motivo de cancelación.',
      minlength: 'Ingresá al menos 5 caracteres.',
    },
  };

  cancel() {
    this.dialogRef.close(null);
  }

  confirm() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close({ cancelReason: this.form.controls.cancelReason.value?.trim() ?? '' });
  }
}
