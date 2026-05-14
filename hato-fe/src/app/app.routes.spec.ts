import { routes } from './app.routes';

describe('app routes', () => {
  it('should have the authenticated shell root guarded by role-aware redirect', () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent);
    const rootRoute = protectedShell?.children?.find((candidate) => candidate.path === '');

    expect(rootRoute?.pathMatch).toBe('full');
    expect(rootRoute?.canActivate?.length).toBe(1);
  });

  it('should expose the admin decision support route before reporting fallback navigation', async () => {
    const route = routes.find((candidate) => candidate.path === '' && candidate.children)?.children?.find((candidate) => candidate.path === 'admin/decision-support');

    expect(route?.path).toBe('admin/decision-support');
    expect(route?.canActivate).toBeDefined();

    const component = await route?.loadComponent?.();
    expect(component).toBeDefined();
  });

  it('should expose guest routes for login, ganadero registration and internal initial setup', () => {
    const publicShell = routes.find((candidate) => candidate.path === '' && candidate.component)?.children ?? [];

    expect(publicShell.some((route) => route.path === 'login')).toBe(true);
    expect(publicShell.some((route) => route.path === 'registro')).toBe(true);
    expect(publicShell.some((route) => route.path === 'admin/bootstrap')).toBe(true);
  });

  it('should redirect ganadero manual offline tooling routes with valid Angular redirect routes and keep admin conflicts admin-only', () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const routePaths = protectedShell.map((route) => route.path);
    const adminConflictsRoute = protectedShell.find((route) => route.path === 'admin/conflictos');
    const ganaderoOfflineToolRoutes = protectedShell.filter((route) =>
      ['ganadero/backups', 'ganadero/conflictos', 'ganadero/sincronizacion'].includes(route.path ?? '')
    );

    expect(routePaths).toContain('ganadero/dashboard');
    expect(routePaths).not.toContain('admin/backups');
    expect(adminConflictsRoute?.canActivate?.length).toBe(1);
    expect(ganaderoOfflineToolRoutes.map((route) => route.path)).toEqual([
      'ganadero/sincronizacion',
      'ganadero/backups',
      'ganadero/conflictos',
    ]);
    expect(ganaderoOfflineToolRoutes.every((route) => route.redirectTo === 'ganadero/dashboard')).toBe(true);
    expect(ganaderoOfflineToolRoutes.every((route) => route.pathMatch === 'full')).toBe(true);
    expect(ganaderoOfflineToolRoutes.every((route) => route.canMatch === undefined)).toBe(true);
    expect(ganaderoOfflineToolRoutes.every((route) => route.loadComponent === undefined)).toBe(true);
  });

  it('should expose a protected forbidden page for authenticated users without route permission', () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const forbiddenRoute = protectedShell.find((route) => route.path === '403');

    expect(forbiddenRoute?.data?.['title']).toBe('Acceso denegado');
    expect(forbiddenRoute?.canActivate).toBeUndefined();
  });

  it('should lazy-load the real ganadero notification inbox page', async () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const route = protectedShell.find((candidate) => candidate.path === 'ganadero/notificaciones');

    expect(route?.data?.['title']).toBe('Notificaciones');
    expect(await route?.loadComponent?.()).toBeDefined();
  });

  it('should expose role-aware animal detail routes with shell metadata', async () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const ganaderoDetail = protectedShell.find((candidate) => candidate.path === 'ganadero/animales/:uuid');
    const adminDetail = protectedShell.find((candidate) => candidate.path === 'admin/animales/:uuid');

    expect(ganaderoDetail?.data?.['title']).toBe('Ficha animal');
    expect(adminDetail?.data?.['title']).toBe('Ficha animal');
    expect(ganaderoDetail?.canActivate?.length).toBe(1);
    expect(adminDetail?.canActivate?.length).toBe(1);
    expect(await ganaderoDetail?.loadComponent?.()).toBeDefined();
    expect(await adminDetail?.loadComponent?.()).toBeDefined();
  });

  it('should expose role-aware animal create and edit full-page routes before detail routes', async () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const paths = protectedShell.map((route) => route.path);
    const ganaderoCreate = protectedShell.find((candidate) => candidate.path === 'ganadero/animales/nuevo');
    const ganaderoEdit = protectedShell.find((candidate) => candidate.path === 'ganadero/animales/:uuid/editar');
    const adminCreate = protectedShell.find((candidate) => candidate.path === 'admin/animales/nuevo');
    const adminEdit = protectedShell.find((candidate) => candidate.path === 'admin/animales/:uuid/editar');

    expect(paths.indexOf('ganadero/animales/:uuid/editar')).toBeLessThan(paths.indexOf('ganadero/animales/:uuid'));
    expect(paths.indexOf('admin/animales/:uuid/editar')).toBeLessThan(paths.indexOf('admin/animales/:uuid'));
    expect(ganaderoCreate?.data?.['title']).toBe('Nuevo animal');
    expect(ganaderoEdit?.data?.['title']).toBe('Editar animal');
    expect(adminCreate?.canActivate?.length).toBe(1);
    expect(adminEdit?.canActivate?.length).toBe(1);
    expect(await ganaderoCreate?.loadComponent?.()).toBeDefined();
    expect(await ganaderoEdit?.loadComponent?.()).toBeDefined();
    expect(await adminCreate?.loadComponent?.()).toBeDefined();
    expect(await adminEdit?.loadComponent?.()).toBeDefined();
  });
});
