import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService, type OfflineSessionStatus } from '../../../../core/auth/data-access/auth.service';
import { ThemeService } from '../../../../core/theme/data-access/theme';
import { BrandLockupComponent } from '../../../../shared/ui/brand-lockup/brand-lockup.component';
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
    BrandLockupComponent,
    FormErrorsComponent,
  ],
  templateUrl: './login-page.component.html',
  styleUrl: './login-page.component.scss',
})
export class LoginPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly queryParamMap = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly feedbackMessage = signal<string | null>(null);
  private readonly sessionContext = computed<OfflineSessionStatus | null>(() =>
    parseSessionContext(this.queryParamMap().get('session'))
  );
  private readonly returnUrl = computed(() => this.queryParamMap().get('returnUrl') || this.defaultDashboardUrl());
  readonly sessionMessage = computed(() => {
    const sessionContext = this.sessionContext();

    if (sessionContext === 'expired') {
      return 'Tu sesión sin conexión expiró. Volvé a iniciar sesión antes de sincronizar o entrar a la app.';
    }

    if (sessionContext === 'reauth_required') {
      return 'Este dispositivo requiere reautenticación antes de continuar con la sincronización.';
    }

    return null;
  });

  readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  readonly messages = {
    username: { required: 'Ingresá tu correo o CI.' },
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

      void this.router.navigateByUrl(this.returnUrl());
    });
  }

  private defaultDashboardUrl() {
    return this.authService.currentUser()?.role === 'GANADERO' ? '/ganadero/dashboard' : '/admin/dashboard';
  }
}

function parseSessionContext(value: string | null): OfflineSessionStatus | null {
  if (value === 'active' || value === 'reauth_required' || value === 'expired') {
    return value;
  }

  return null;
}
