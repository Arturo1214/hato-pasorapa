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

  it('should expose the ganadero routes and keep admin conflicts admin-only', () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const routePaths = protectedShell.map((route) => route.path);
    const adminConflictsRoute = protectedShell.find((route) => route.path === 'admin/conflictos');

    expect(routePaths).toContain('ganadero/dashboard');
    expect(routePaths).toContain('ganadero/backups');
    expect(routePaths).toContain('ganadero/conflictos');
    expect(routePaths).toContain('ganadero/sincronizacion');
    expect(routePaths).not.toContain('admin/backups');
    expect(adminConflictsRoute?.canActivate?.length).toBe(1);
  });

  it('should lazy-load the real ganadero notification inbox page', async () => {
    const protectedShell = routes.find((candidate) => candidate.path === '' && candidate.loadComponent)?.children ?? [];
    const route = protectedShell.find((candidate) => candidate.path === 'ganadero/notificaciones');

    expect(route?.data?.['title']).toBe('Notificaciones');
    expect(await route?.loadComponent?.()).toBeDefined();
  });
});
