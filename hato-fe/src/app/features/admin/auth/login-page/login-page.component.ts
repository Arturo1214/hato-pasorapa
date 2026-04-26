import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { ALLOWED_ROLES_MESSAGE } from '../../../../core/auth/auth-rules';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ThemeService } from '../../../../core/theme/data-access/theme';
import { FormErrorsComponent } from '../../../../shared/ui/form-errors/form-errors.component';

@Component({
  selector: 'app-login-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    RouterLink,
    FormErrorsComponent,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly feedbackMessage = signal<string | null>(null);
  readonly allowedRolesMessage = ALLOWED_ROLES_MESSAGE;

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  readonly messages = {
    username: { required: 'Ingresá tu usuario o correo.' },
    password: { required: 'Ingresá tu contraseña.' },
  };

  submit() {
    if (this.form.invalid || this.authService.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.feedbackMessage.set(null);

    this.authService.login(this.form.getRawValue()).subscribe((result) => {
      if (!result.success) {
        this.feedbackMessage.set(result.error?.message ?? 'No pudimos iniciar sesión.');
        return;
      }

      void this.router.navigate(['/']);
    });
  }
}
