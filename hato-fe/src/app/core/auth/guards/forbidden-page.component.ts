import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../data-access/auth.service';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [MatButtonModule, MatCardModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="forbidden-page">
      <mat-card class="forbidden-card surface-panel">
        <mat-icon class="forbidden-icon" aria-hidden="true">lock</mat-icon>
        <p class="eyebrow">403</p>
        <h1>No tenés acceso a esta sección</h1>
        <p class="support-copy">
          Tu usuario está activo, pero no tiene permisos para entrar a esta pantalla. Si necesitás acceso,
          pedile a un administrador que revise tu rol.
        </p>

        <div class="actions">
          <a mat-flat-button color="primary" [routerLink]="defaultDashboardUrl()">Volver a mi dashboard</a>
          <button mat-stroked-button type="button" (click)="logout()">Cerrar sesión</button>
        </div>
      </mat-card>
    </section>
  `,
  styles: [
    `
      .forbidden-page {
        min-height: min(32rem, 70vh);
        display: grid;
        place-items: center;
        padding: 1rem;
      }

      .forbidden-card {
        width: min(100%, 36rem);
        padding: 2rem;
        display: grid;
        gap: 1rem;
        text-align: center;
      }

      .forbidden-icon {
        justify-self: center;
        width: 3rem;
        height: 3rem;
        font-size: 3rem;
        color: var(--mat-sys-error);
      }

      .eyebrow {
        margin: 0;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        font-size: 0.75rem;
        color: var(--mat-sys-error);
      }

      h1,
      .support-copy {
        margin: 0;
      }

      .support-copy {
        color: var(--mat-sys-on-surface-variant);
      }

      .actions {
        display: flex;
        justify-content: center;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class ForbiddenPageComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  defaultDashboardUrl() {
    return this.authService.currentUser()?.role === 'GANADERO' ? '/ganadero/dashboard' : '/admin/dashboard';
  }

  logout() {
    this.authService.logout();
  }
}
