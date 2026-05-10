import { CommonModule } from '@angular/common';
import { Component, computed, inject, output } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, PRIMARY_OUTLET, Router } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { GanaderoNotificationsStore } from '../../../../features/ganadero/notifications/data-access/ganadero-notifications.store';
import { ThemeService } from '../../../../core/theme/data-access/theme';

interface RouteViewMeta {
  title: string;
  subtitle: string;
}

const DEFAULT_ROUTE_VIEW_META: RouteViewMeta = {
  title: 'Dashboard',
  subtitle: 'Resumen operativo del establecimiento, su rodeo y las tareas prioritarias del día.',
};

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
  readonly notificationsStore = inject(GanaderoNotificationsStore);
  readonly toggleSidebar = output<void>();

  readonly routeData = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      startWith(null),
      map(() => this.resolveRouteViewMeta())
    ),
    {
      initialValue: DEFAULT_ROUTE_VIEW_META,
    }
  );

  readonly greeting = computed(() => this.authService.currentUser()?.displayName ?? 'Equipo Hato');
  readonly isGanadero = computed(() => this.authService.currentUser()?.role === 'GANADERO');

  constructor() {
    if (this.isGanadero()) {
      void this.notificationsStore.refreshUnreadCount();
    }
  }

  navigateToNotifications() {
    void this.router.navigateByUrl('/ganadero/notificaciones');
  }

  private resolveRouteViewMeta(): RouteViewMeta {
    const rootSnapshot = this.router.routerState.snapshot?.root ?? this.activatedRoute.snapshot ?? null;
    const routeChain = this.collectPrimaryRouteChain(rootSnapshot);

    for (let index = routeChain.length - 1; index >= 0; index -= 1) {
      const routeViewMeta = this.extractRouteViewMeta(routeChain[index]);

      if (routeViewMeta) {
        return routeViewMeta;
      }
    }

    const fallbackTitle = this.resolveFallbackTitle(routeChain.at(-1) ?? null);

    return {
      title: fallbackTitle,
      subtitle: DEFAULT_ROUTE_VIEW_META.subtitle,
    };
  }

  private collectPrimaryRouteChain(snapshot: ActivatedRouteSnapshot | null): ActivatedRouteSnapshot[] {
    const routeChain: ActivatedRouteSnapshot[] = [];
    let currentSnapshot = snapshot;

    while (currentSnapshot) {
      routeChain.push(currentSnapshot);
      currentSnapshot =
        currentSnapshot.children.find((childSnapshot) => childSnapshot.outlet === PRIMARY_OUTLET) ??
        currentSnapshot.firstChild ??
        null;
    }

    return routeChain;
  }

  private extractRouteViewMeta(snapshot: ActivatedRouteSnapshot | null): RouteViewMeta | null {
    const title = snapshot?.data?.['title'];
    const subtitle = snapshot?.data?.['subtitle'];

    if (typeof title !== 'string' || typeof subtitle !== 'string') {
      return null;
    }

    return { title, subtitle };
  }

  private resolveFallbackTitle(snapshot: ActivatedRouteSnapshot | null): string {
    const routeConfigPath = snapshot?.routeConfig?.path;

    if (typeof routeConfigPath === 'string') {
      const titleFromRoutePath = this.humanizeRoutePath(routeConfigPath);

      if (titleFromRoutePath !== DEFAULT_ROUTE_VIEW_META.title) {
        return titleFromRoutePath;
      }
    }

    return this.humanizeRoutePath(this.router.url);
  }

  private humanizeRoutePath(path: string): string {
    const normalizedPath = path
      .split(/[?#]/, 1)[0]
      .split('/')
      .map((segment) => segment.trim())
      .filter((segment) => segment.length > 0 && segment !== 'admin')
      .at(-1);

    if (!normalizedPath) {
      return DEFAULT_ROUTE_VIEW_META.title;
    }

    return normalizedPath
      .split('-')
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
      .join(' ');
  }
}
