import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { PASSWORD_POLICY_MESSAGE, passwordPolicyValidators } from '../../../shared/forms/password-policy';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { ProfileService } from './data-access/profile.service';

function passwordsMatch(value: { newPassword: string; confirmPassword: string }): null | { passwordMismatch: true } {
  return value.newPassword === value.confirmPassword ? null : { passwordMismatch: true };
}

function resolveErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && typeof error.error?.message === 'string' && error.error.message.length > 0) {
    return error.error.message;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    'error' in error &&
    typeof (error as { error?: { message?: unknown } }).error?.message === 'string'
  ) {
    return (error as { error: { message: string } }).error.message;
  }

  return fallback;
}

@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    FormErrorsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="profile-page">
      <header class="page-header">
        <h1>Perfil</h1>
        <p>Completá tus datos de contacto y actualizá tu contraseña cuando lo necesités.</p>
      </header>

      <mat-card appearance="outlined">
        <p><strong>Usuario:</strong> {{ authService.currentUser()?.displayName ?? 'Sin sesión' }}</p>
        <p><strong>Correo:</strong> {{ authService.currentUser()?.email ?? 'Sin correo' }}</p>
      </mat-card>

      @if (isGanadero()) {
        <mat-card appearance="outlined">
          <form [formGroup]="profileForm" class="form-grid" (ngSubmit)="submitProfile()">
            <mat-form-field appearance="outline">
              <mat-label>Teléfono *</mat-label>
              <input matInput formControlName="telefono" required />
              <app-form-errors [control]="profileForm.controls.telefono" [messages]="profileMessages.telefono" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Dirección *</mat-label>
              <input matInput formControlName="direccion" required />
              <app-form-errors [control]="profileForm.controls.direccion" [messages]="profileMessages.direccion" />
            </mat-form-field>

            <button mat-flat-button color="primary" type="submit" [disabled]="profileForm.invalid || profileSubmitting()">
              {{ profileSubmitting() ? 'Guardando…' : 'Guardar datos' }}
            </button>
          </form>
        </mat-card>
      }

      <mat-card appearance="outlined">
        <form [formGroup]="passwordForm" class="form-grid" (ngSubmit)="submitPassword()">
          <mat-form-field appearance="outline">
            <mat-label>Contraseña actual *</mat-label>
            <input matInput type="password" formControlName="currentPassword" autocomplete="current-password" required />
            <app-form-errors
              [control]="passwordForm.controls.currentPassword"
              [messages]="passwordMessages.currentPassword"
            />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nueva contraseña *</mat-label>
            <input matInput type="password" formControlName="newPassword" autocomplete="new-password" required />
            <app-form-errors [control]="passwordForm.controls.newPassword" [messages]="passwordMessages.newPassword" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirmar contraseña *</mat-label>
            <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" required />
            <app-form-errors
              [control]="passwordForm.controls.confirmPassword"
              [messages]="passwordMessages.confirmPassword"
            />
          </mat-form-field>

          @if (passwordMismatch()) {
            <p class="feedback error">Las contraseñas no coinciden.</p>
          }

          <button
            mat-stroked-button
            color="primary"
            type="submit"
            [disabled]="passwordForm.invalid || passwordSubmitting() || passwordMismatch()"
          >
            {{ passwordSubmitting() ? 'Actualizando…' : 'Cambiar contraseña' }}
          </button>
        </form>
      </mat-card>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status"><p class="feedback success">{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert"><p class="feedback error">{{ errorMessage() }}</p></mat-card>
      }
    </section>
  `,
  styles: [
    `
      .profile-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .form-grid {
        display: grid;
        gap: 1rem;
      }

      .feedback {
        margin: 0;
      }

      .success {
        color: var(--mat-sys-primary);
      }

      .error {
        color: var(--mat-sys-error);
      }
    `,
  ],
})
export class ProfilePageComponent {
  readonly authService = inject(AuthService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly profileService = inject(ProfileService);

  readonly isGanadero = computed(() => this.authService.currentUser()?.role === 'GANADERO');
  readonly profileSubmitting = signal(false);
  readonly passwordSubmitting = signal(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly profileForm = this.formBuilder.nonNullable.group({
    telefono: ['', [Validators.required]],
    direccion: ['', [Validators.required]],
  });
  readonly passwordForm = this.formBuilder.nonNullable.group(
    {
      currentPassword: ['', [Validators.required]],
      newPassword: ['', passwordPolicyValidators],
      confirmPassword: ['', [Validators.required]],
    },
    {
      validators: (group) => passwordsMatch(group.getRawValue()),
    }
  );
  readonly profileMessages = {
    telefono: { required: 'Ingresá tu teléfono.' },
    direccion: { required: 'Ingresá tu dirección.' },
  };
  readonly passwordMessages = {
    currentPassword: { required: 'Ingresá tu contraseña actual.' },
    newPassword: {
      required: 'Ingresá una contraseña segura.',
      minlength: PASSWORD_POLICY_MESSAGE,
      pattern: PASSWORD_POLICY_MESSAGE,
    },
    confirmPassword: { required: 'Confirmá tu nueva contraseña.' },
  };

  submitProfile() {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.feedbackMessage.set(null);
    this.profileSubmitting.set(true);

    this.profileService
      .updateProfile(this.profileForm.getRawValue())
      .pipe(finalize(() => this.profileSubmitting.set(false)))
      .subscribe({
        next: () => this.feedbackMessage.set('Perfil actualizado correctamente.'),
        error: (error: unknown) => this.errorMessage.set(resolveErrorMessage(error, 'No pudimos guardar tus datos.')),
      });
  }

  submitPassword() {
    if (this.passwordForm.invalid || this.passwordMismatch()) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword } = this.passwordForm.getRawValue();
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);
    this.passwordSubmitting.set(true);

    this.profileService
      .updatePassword({ currentPassword, newPassword })
      .pipe(finalize(() => this.passwordSubmitting.set(false)))
      .subscribe({
        next: (response) => {
          this.passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' });
          this.feedbackMessage.set(response.message);
        },
        error: (error: unknown) => this.errorMessage.set(resolveErrorMessage(error, 'No pudimos actualizar tu contraseña.')),
      });
  }

  passwordMismatch() {
    return this.passwordForm.hasError('passwordMismatch');
  }
}
