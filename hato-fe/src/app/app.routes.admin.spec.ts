import { routes } from './app.routes';

describe('admin routes', () => {
  it('should expose the admin dashboard, reportes, backups, users, ganaderos, conflictos, animales, visitas veterinarias, calendario and notificaciones routes', () => {
    const protectedShell = routes.find((route) => route.path === '');
    const children = protectedShell?.children ?? [];

    expect(children.some((route) => route.path === 'admin/dashboard')).toBe(true);
    expect(children.some((route) => route.path === 'admin/reportes')).toBe(true);
    expect(children.some((route) => route.path === 'admin/backups')).toBe(true);
    expect(children.some((route) => route.path === 'admin/usuarios')).toBe(true);
    expect(children.some((route) => route.path === 'admin/ganaderos')).toBe(true);
    expect(children.some((route) => route.path === 'admin/conflictos')).toBe(true);
    expect(children.some((route) => route.path === 'admin/animales')).toBe(true);
    expect(children.some((route) => route.path === 'admin/visitas-veterinarias')).toBe(true);
    expect(children.some((route) => route.path === 'admin/calendario')).toBe(true);
    expect(children.some((route) => route.path === 'admin/notificaciones')).toBe(true);
  });
});
