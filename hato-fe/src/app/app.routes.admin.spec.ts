import type { Route } from '@angular/router';
import { routes } from './app.routes';
import { MainLayout } from './ui/layout/main-layout/main-layout';

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

const collectProtectedRenderableRoutes = (routes: readonly Route[]): Route[] =>
  routes.flatMap((route) => {
    if (route.path === '**' || route.redirectTo || route.path === '') {
      return [];
    }

    if (route.children?.length) {
      return collectProtectedRenderableRoutes(route.children);
    }

    if (route.component || route.loadComponent) {
      return [route];
    }

    return [];
  });

describe('admin routes', () => {
  it('should require non-empty header metadata for every authenticated route rendered inside MainLayout', async () => {
    const protectedShell = routes.find((route) => route.path === '' && route.loadComponent);

    expect(protectedShell).toBeDefined();
    expect(await protectedShell?.loadComponent?.()).toBe(MainLayout);

    const protectedRoutes = collectProtectedRenderableRoutes(protectedShell?.children ?? []);

    expect(protectedRoutes.map((route) => route.path)).toEqual([
      'perfil',
      'admin/dashboard',
      'admin/reportes',
      'admin/decision-support',
      'admin/usuarios',
      'admin/ganaderos',
      'admin/razas',
      'admin/conflictos',
      'admin/notificaciones',
      'admin/animales',
      'admin/animales/nuevo',
      'admin/animales/:uuid/editar',
      'admin/animales/:uuid',
      'ganadero/dashboard',
      'ganadero/animales',
      'ganadero/animales/nuevo',
      'ganadero/animales/:uuid/editar',
      'ganadero/animales/:uuid',
      'ganadero/visitas',
      'ganadero/calendario',
      'ganadero/notificaciones',
      '403',
    ]);

    const routesMissingHeaderMeta = protectedRoutes
      .map((route) => ({
        path: route.path ?? '(empty)',
        title: route.data?.['title'],
        subtitle: route.data?.['subtitle'],
      }))
      .filter(({ title, subtitle }) => !isNonEmptyString(title) || !isNonEmptyString(subtitle));

    expect(routesMissingHeaderMeta).toEqual([]);
  });

  it('should keep the authenticated shell root reserved for role-aware redirect', () => {
    const protectedShell = routes.find((route) => route.path === '');
    const rootRoute = protectedShell?.children?.find((route) => route.path === '');

    expect(rootRoute?.loadComponent).toBeDefined();
    expect(rootRoute?.canActivate?.length).toBe(1);
  });

  it('should expose the admin razas route with header metadata and admin guard', () => {
    const protectedShell = routes.find((route) => route.path === '');
    const razasRoute = protectedShell?.children?.find((route) => route.path === 'admin/razas');

    expect(razasRoute?.loadComponent).toBeDefined();
    expect(razasRoute?.canActivate?.length).toBe(1);
    expect(razasRoute?.data?.['title']).toBe('Razas');
    expect(razasRoute?.data?.['subtitle']).toContain('catálogo');
  });
});
