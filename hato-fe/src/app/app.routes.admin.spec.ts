import { routes } from './app.routes';

describe('admin routes', () => {
  it('should expose the admin dashboard, users and ganaderos routes', () => {
    const protectedShell = routes.find((route) => route.path === '');
    const children = protectedShell?.children ?? [];

    expect(children.some((route) => route.path === 'admin/dashboard')).toBe(true);
    expect(children.some((route) => route.path === 'admin/usuarios')).toBe(true);
    expect(children.some((route) => route.path === 'admin/ganaderos')).toBe(true);
  });
});
