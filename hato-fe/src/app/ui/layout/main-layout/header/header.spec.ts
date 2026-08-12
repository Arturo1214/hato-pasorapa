import { type ComponentFixture, TestBed } from '@angular/core/testing';
import {
  ActivatedRoute,
  type ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
} from '@angular/router';
import { signal } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { GanaderoNotificationsStore } from '../../../../features/ganadero/notifications/data-access/ganadero-notifications.store';
import { ThemeService } from '../../../../core/theme/data-access/theme';
import { HeaderComponent } from './header';

describe('HeaderComponent', () => {
  const logout = vi.fn();
  const toggleTheme = vi.fn();
  const unreadCount = signal(0);
  const onlineState = signal(true);
  const refreshUnreadCount = vi.fn().mockResolvedValue(undefined);
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  let routerEvents: Subject<NavigationEnd>;

  const createSnapshot = ({
    data,
    path,
    firstChild,
  }: {
    data?: Record<string, string>;
    path?: string;
    firstChild?: ActivatedRouteSnapshot;
  }): ActivatedRouteSnapshot =>
    ({
      data: data ?? {},
      routeConfig: path ? { path } : undefined,
      firstChild,
      children: firstChild ? [firstChild] : [],
      outlet: 'primary',
    }) as ActivatedRouteSnapshot;

  const configureHeader = async ({
    url,
    rootSnapshot,
    activatedRoute,
    currentUser = { displayName: 'Admin Root', role: 'ADMIN' },
  }: {
    url: string;
    rootSnapshot?: ActivatedRouteSnapshot;
    activatedRoute?: object;
    currentUser?: { displayName: string; role: 'ADMIN' | 'GANADERO' };
  }): Promise<ComponentFixture<HeaderComponent>> => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            events: routerEvents.asObservable(),
            url,
            navigateByUrl,
            routerState: {
              snapshot: {
                root: rootSnapshot,
              },
            },
          },
        },
        {
          provide: ActivatedRoute,
          useValue: activatedRoute ?? {
            snapshot: rootSnapshot,
          },
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: () => currentUser,
            logout,
          },
        },
        {
          provide: GanaderoNotificationsStore,
          useValue: {
            unreadCount,
            refreshUnreadCount,
          },
        },
        {
          provide: OfflineStatusService,
          useValue: {
            isOnline: onlineState,
          },
        },
        {
          provide: ThemeService,
          useValue: {
            currentTheme: () => 'dark',
            toggleTheme,
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(HeaderComponent);
    fixture.detectChanges();
    return fixture;
  };

  beforeEach(() => {
    logout.mockClear();
    toggleTheme.mockClear();
    refreshUnreadCount.mockClear();
    navigateByUrl.mockClear();
    unreadCount.set(0);
    onlineState.set(true);
    routerEvents = new Subject<NavigationEnd>();
  });

  it('should render branding, current user, theme toggle and logout action', async () => {
    const dashboardSnapshot = createSnapshot({
      path: 'admin/dashboard',
      data: {
        title: 'Dashboard',
        subtitle: 'Resumen del panel administrativo.',
      },
    });
    const rootSnapshot = createSnapshot({ firstChild: dashboardSnapshot });
    const fixture = await configureHeader({
      url: '/admin/dashboard',
      rootSnapshot,
    });
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Dashboard');
    expect(text).toContain('Resumen del panel administrativo.');
    expect(text).toContain('Admin Root');
    expect(text).not.toContain('Pasorapa');
    expect(fixture.nativeElement.querySelectorAll('button')).toHaveLength(3);
    expect(
      fixture.nativeElement.querySelector('[data-testid="ganadero-notification-bell"]'),
    ).toBeNull();
  });

  it('should show the online connectivity indicator in Spanish', async () => {
    const dashboardSnapshot = createSnapshot({
      path: 'ganadero/dashboard',
      data: {
        title: 'Dashboard',
        subtitle: 'Resumen ganadero.',
      },
    });

    const fixture = await configureHeader({
      url: '/ganadero/dashboard',
      rootSnapshot: createSnapshot({ firstChild: dashboardSnapshot }),
      currentUser: { displayName: 'Ganadero Uno', role: 'GANADERO' },
    });
    const indicator = fixture.nativeElement.querySelector(
      '[data-testid="header-connectivity-status"]',
    ) as HTMLElement;

    expect(indicator.textContent).toContain('En línea');
    expect(indicator.getAttribute('aria-label')).toBe('Estado de conexión: en línea');
  });

  it('should keep the offline connectivity indicator visible across route changes', async () => {
    onlineState.set(false);
    const animalsSnapshot = createSnapshot({
      path: 'ganadero/animales',
      data: {
        title: 'Animales',
        subtitle: 'Consultá tu rodeo.',
      },
    });
    const rootSnapshot = createSnapshot({ firstChild: animalsSnapshot });
    const fixture = await configureHeader({
      url: '/ganadero/animales',
      rootSnapshot,
      currentUser: { displayName: 'Ganadero Uno', role: 'GANADERO' },
    });

    routerEvents.next(new NavigationEnd(1, '/ganadero/animales', '/ganadero/dashboard'));
    fixture.detectChanges();

    const indicator = fixture.nativeElement.querySelector(
      '[data-testid="header-connectivity-status"]',
    ) as HTMLElement;
    expect(indicator.textContent).toContain('Sin conexión');
    expect(indicator.getAttribute('aria-label')).toBe('Estado de conexión: sin conexión');
  });

  it('should render a GANADERO-only notification bell with unread badge', async () => {
    unreadCount.set(5);
    const dashboardSnapshot = createSnapshot({
      path: 'ganadero/dashboard',
      data: {
        title: 'Dashboard',
        subtitle: 'Resumen ganadero.',
      },
    });
    const fixture = await configureHeader({
      url: '/ganadero/dashboard',
      rootSnapshot: createSnapshot({ firstChild: dashboardSnapshot }),
      currentUser: { displayName: 'Ganadero Uno', role: 'GANADERO' },
    });
    const bell = fixture.nativeElement.querySelector(
      '[data-testid="ganadero-notification-bell"]',
    ) as HTMLButtonElement;

    expect(bell).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('5');
    bell.click();
    expect(navigateByUrl).toHaveBeenCalledWith('/ganadero/notificaciones');
    expect(refreshUnreadCount).toHaveBeenCalled();
  });

  it('should hide the notification badge when the GANADERO unread count is zero', async () => {
    const dashboardSnapshot = createSnapshot({
      path: 'ganadero/dashboard',
      data: {
        title: 'Dashboard',
        subtitle: 'Resumen ganadero.',
      },
    });
    const fixture = await configureHeader({
      url: '/ganadero/dashboard',
      rootSnapshot: createSnapshot({ firstChild: dashboardSnapshot }),
      currentUser: { displayName: 'Ganadero Uno', role: 'GANADERO' },
    });

    expect(
      fixture.nativeElement.querySelector('[data-testid="ganadero-notification-bell"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="ganadero-notification-count"]'),
    ).toBeNull();
  });

  it('should delegate logout to the auth service from the header action', async () => {
    const dashboardSnapshot = createSnapshot({
      path: 'admin/dashboard',
      data: {
        title: 'Dashboard',
        subtitle: 'Resumen del panel administrativo.',
      },
    });
    const fixture = await configureHeader({
      url: '/admin/dashboard',
      rootSnapshot: createSnapshot({ firstChild: dashboardSnapshot }),
    });
    const buttons = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    buttons[2].click();

    expect(logout).toHaveBeenCalled();
  });

  it('should resolve metadata from the deepest lazy nested route', async () => {
    const reportesSnapshot = createSnapshot({
      path: 'admin/reportes',
      data: {
        title: 'Reportes',
        subtitle:
          'Indicadores agregados para productividad, costos, frescura y actividad reciente.',
      },
    });
    const lazyShellSnapshot = createSnapshot({ firstChild: reportesSnapshot });
    const fixture = await configureHeader({
      url: '/admin/reportes',
      rootSnapshot: createSnapshot({ firstChild: lazyShellSnapshot }),
    });

    expect(fixture.componentInstance.routeData()).toEqual({
      title: 'Reportes',
      subtitle: 'Indicadores agregados para productividad, costos, frescura y actividad reciente.',
    });
  });

  it('should fallback safely to the url when the deepest route has no metadata', async () => {
    const reportesSnapshot = createSnapshot({ path: 'admin/reportes' });
    const fixture = await configureHeader({
      url: '/admin/reportes',
      rootSnapshot: createSnapshot({ firstChild: reportesSnapshot }),
    });

    expect(fixture.componentInstance.routeData()).toEqual({
      title: 'Reportes',
      subtitle:
        'Resumen operativo del establecimiento, su rodeo y las tareas prioritarias del día.',
    });
  });

  it('should not throw when the route tree is unavailable and should use the panel default', async () => {
    const fixture = await configureHeader({
      url: '/',
      activatedRoute: {},
    });

    expect(fixture.componentInstance.routeData()).toEqual({
      title: 'Panel',
      subtitle:
        'Resumen operativo del establecimiento, su rodeo y las tareas prioritarias del día.',
    });
  });
});
