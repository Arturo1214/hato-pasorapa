import { CommonModule } from '@angular/common';
import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ThemeService } from '../../../../core/theme/data-access/theme';

@Component({
  selector: 'app-header',
  imports: [CommonModule, MatButtonModule, MatIconModule, MatToolbarModule, MatTooltipModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
export class HeaderComponent {
  private readonly router = inject(Router);
  private readonly activatedRoute = inject(ActivatedRoute);
  readonly authService = inject(AuthService);
  readonly themeService = inject(ThemeService);
  readonly toggleSidebar = output<void>();

  readonly routeData = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => {
        let currentRoute = this.activatedRoute;
        while (currentRoute.firstChild) {
          currentRoute = currentRoute.firstChild;
        }

        const routeData = currentRoute?.snapshot?.data ?? {};

        return {
          title: (routeData['title'] as string | undefined) ?? 'Inicio',
          subtitle: (routeData['subtitle'] as string | undefined) ?? 'Base visual y técnica para el frontend de Hato.',
        };
      })
    ),
    {
      initialValue: {
        title: 'Inicio',
        subtitle: 'Base visual y técnica para el frontend de Hato.',
      },
    }
  );

  readonly greeting = computed(() => this.authService.currentUser()?.displayName ?? 'Equipo Hato');
}
