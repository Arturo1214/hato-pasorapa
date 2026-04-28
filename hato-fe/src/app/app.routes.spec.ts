import { routes } from './app.routes';

describe('app routes', () => {
  it('should expose the admin decision support route before reporting fallback navigation', async () => {
    const route = routes.find((candidate) => candidate.path === '' && candidate.children)?.children?.find((candidate) => candidate.path === 'admin/decision-support');

    expect(route?.path).toBe('admin/decision-support');
    expect(route?.canActivate).toBeDefined();

    const component = await route?.loadComponent?.();
    expect(component).toBeDefined();
  });
});
