import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { ThemeService } from '../../../core/theme/data-access/theme';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly loginError = signal(false);

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  submit() {
    if (this.form.invalid || this.authService.loading()) {
      this.form.markAllAsTouched();
      return;
    }

    this.loginError.set(false);

    this.authService.login(this.form.getRawValue()).subscribe((isAuthenticated) => {
      if (!isAuthenticated) {
        this.loginError.set(true);
        return;
      }

      void this.router.navigate(['/']);
    });
  }
}
