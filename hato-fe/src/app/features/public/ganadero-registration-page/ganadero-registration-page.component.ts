import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { PASSWORD_POLICY_MESSAGE, passwordPolicyValidators } from '../../../shared/forms/password-policy';
import { BrandLockupComponent } from '../../../shared/ui/brand-lockup/brand-lockup.component';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';

function passwordsMatch(value: {
  password: string;
  confirmPassword: string;
}): null | { passwordMismatch: true } {
  return value.password === value.confirmPassword ? null : { passwordMismatch: true };
}

@Component({
  selector: 'app-ganadero-registration-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    BrandLockupComponent,
    FormErrorsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="registration-shell">
      <mat-card class="registration-card surface-panel">
        <app-brand-lockup
          class="registration-brand"
          size="card"
          layout="stacked"
          subtitle="Registro pensado para productores y equipos de campo."
        />

        <p class="eyebrow">Registro</p>
        <h1>Registro de ganaderos</h1>
        <p class="support-copy">Completá tu alta y entrá directo al dashboard para seguir trabajando.</p>

        <form [formGroup]="form" class="registration-form" (ngSubmit)="submit()">
          <mat-form-field appearance="outline">
            <mat-label>CI o identificador *</mat-label>
            <input matInput formControlName="businessIdentifier" required />
            <app-form-errors [control]="form.controls.businessIdentifier" [messages]="messages.businessIdentifier" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nombre completo *</mat-label>
            <input matInput formControlName="name" required />
            <app-form-errors [control]="form.controls.name" [messages]="messages.name" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Correo *</mat-label>
            <input matInput type="email" formControlName="email" required />
            <app-form-errors [control]="form.controls.email" [messages]="messages.email" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña *</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" required />
            <app-form-errors [control]="form.controls.password" [messages]="messages.password" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Confirmar contraseña *</mat-label>
            <input matInput type="password" formControlName="confirmPassword" autocomplete="new-password" required />
            <app-form-errors [control]="form.controls.confirmPassword" [messages]="messages.confirmPassword" />
          </mat-form-field>

          <input
            class="honeypot"
            type="text"
            formControlName="website"
            tabindex="-1"
            autocomplete="off"
            aria-hidden="true"
          />

          @if (passwordMismatch()) {
            <div class="feedback-box" role="alert">
              <mat-icon>error</mat-icon>
              <span>Las contraseñas no coinciden.</span>
            </div>
          }

          @if (feedbackMessage()) {
            <div class="feedback-box" role="alert">
              <mat-icon>error</mat-icon>
              <span>{{ feedbackMessage() }}</span>
            </div>
          }

          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting() || passwordMismatch()">
            {{ submitting() ? 'Registrando…' : 'Crear cuenta y entrar' }}
          </button>
        </form>

        <div class="registration-actions">
          <a mat-stroked-button routerLink="/login">Ya tengo cuenta</a>
        </div>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .registration-shell {
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 1rem;
      }

      .registration-card {
        width: min(100%, 40rem);
        padding: 2rem;
        display: grid;
        gap: 1rem;
      }

      .registration-brand {
        justify-self: center;
      }

      .eyebrow {
        margin: 0;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 0.75rem;
        color: var(--mat-sys-primary);
      }

      .support-copy {
        color: var(--mat-sys-on-surface-variant);
      }

      .registration-form {
        display: grid;
        gap: 1rem;
      }

      .registration-actions {
        display: flex;
        justify-content: flex-end;
      }

      .honeypot {
        position: absolute;
        left: -9999px;
      }

      .feedback-box {
        display: flex;
        gap: 0.5rem;
        align-items: center;
        padding: 0.75rem 1rem;
        border-radius: 0.75rem;
        background: color-mix(in srgb, var(--mat-sys-error-container) 70%, transparent 30%);
      }
    `,
  ],
})
export class GanaderoRegistrationPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  readonly submitting = signal(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly form = this.formBuilder.nonNullable.group(
    {
      businessIdentifier: ['', [Validators.required]],
      name: ['', [Validators.required]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', passwordPolicyValidators],
      confirmPassword: ['', [Validators.required]],
      website: [''],
      formIssuedAt: [new Date().toISOString(), [Validators.required]],
    },
    {
      validators: (group) => passwordsMatch(group.getRawValue()),
    }
  );
  readonly passwordMismatch = computed(() => this.form.hasError('passwordMismatch'));
  readonly messages = {
    businessIdentifier: { required: 'Ingresá tu CI o identificador.' },
    name: { required: 'Ingresá tu nombre completo.' },
    email: { required: 'Ingresá un correo válido.', email: 'Ingresá un correo válido.' },
    password: {
      required: 'Ingresá una contraseña segura.',
      minlength: PASSWORD_POLICY_MESSAGE,
      pattern: PASSWORD_POLICY_MESSAGE,
    },
    confirmPassword: { required: 'Confirmá la contraseña.' },
  };

  submit() {
    if (this.form.invalid || this.passwordMismatch() || this.authService.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    const { businessIdentifier, name, email, password, website, formIssuedAt } = this.form.getRawValue();
    this.feedbackMessage.set(null);
    this.submitting.set(true);

    this.authService
      .registerGanadero({
        businessIdentifier,
        name,
        email,
        password,
        website,
        formIssuedAt,
      })
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe((result) => {
        if (!result.success) {
          this.feedbackMessage.set(result.error?.message ?? 'Error en el registro, intenta más tarde.');
        }
      });
  }
}
