import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, ActivatedRouteSnapshot, NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ThemeService } from '../../../../core/theme/data-access/theme';
import { HeaderComponent } from './header';

describe('HeaderComponent', () => {
  const logout = vi.fn();
  const toggleTheme = vi.fn();
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
  }: {
    url: string;
    rootSnapshot?: ActivatedRouteSnapshot;
    activatedRoute?: object;
  }): Promise<ComponentFixture<HeaderComponent>> => {
    await TestBed.configureTestingModule({
      imports: [HeaderComponent],
      providers: [
        {
          provide: Router,
          useValue: {
            events: routerEvents.asObservable(),
            url,
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
            currentUser: () => ({ displayName: 'Admin Root', role: 'ADMIN' }),
            logout,
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
    const buttons = fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>;
    buttons[2].click();

    expect(logout).toHaveBeenCalled();
  });

  it('should resolve metadata from the deepest lazy nested route', async () => {
    const reportesSnapshot = createSnapshot({
      path: 'admin/reportes',
      data: {
        title: 'Reportes',
        subtitle: 'Indicadores agregados para productividad, costos, frescura y actividad reciente.',
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
      subtitle: 'Resumen operativo del establecimiento, su rodeo y las tareas prioritarias del día.',
    });
  });

  it('should not throw when the route tree is unavailable and should use the dashboard default', async () => {
    const fixture = await configureHeader({
      url: '/',
      activatedRoute: {},
    });

    expect(fixture.componentInstance.routeData()).toEqual({
      title: 'Dashboard',
      subtitle: 'Resumen operativo del establecimiento, su rodeo y las tareas prioritarias del día.',
    });
  });
});
