import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { PASSWORD_POLICY_MESSAGE, passwordPolicyValidators } from '../../../../shared/forms/password-policy';
import { FormErrorsComponent } from '../../../../shared/ui/form-errors/form-errors.component';

@Component({
  selector: 'app-bootstrap-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    FormErrorsComponent,
  ],
  templateUrl: './bootstrap-page.component.html',
  styleUrl: './bootstrap-page.component.scss',
})
export class BootstrapPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly feedbackMessage = signal<string | null>(null);
  readonly passwordPolicyMessage = PASSWORD_POLICY_MESSAGE;

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required]],
    password: ['', passwordPolicyValidators],
  });

  readonly messages = {
    username: { required: 'Ingresá un usuario administrador.' },
    email: {
      required: 'Ingresá un correo válido.',
      email: 'Ingresá un correo válido.',
    },
    displayName: { required: 'Ingresá un nombre visible para el administrador.' },
    password: {
      required: 'Ingresá una contraseña segura.',
      minlength: PASSWORD_POLICY_MESSAGE,
      pattern: PASSWORD_POLICY_MESSAGE,
    },
  };

  submit() {
    if (this.form.invalid || this.authService.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedbackMessage.set(null);

    this.authService.bootstrap(this.form.getRawValue()).subscribe((result) => {
      if (!result.success) {
        this.feedbackMessage.set(result.error?.message ?? 'No pudimos completar el bootstrap.');
        return;
      }

      void this.router.navigate(['/']);
    });
  }
}
