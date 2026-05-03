import {
  ADMIN_ONLY_ROLES,
  ALLOWED_ROLES,
  ALLOWED_ROLES_MESSAGE,
  GANADERO_ONLY_ROLES,
} from './auth-rules';

describe('auth rules', () => {
  it('should expose ADMIN and GANADERO as the only supported application roles', () => {
    expect(ALLOWED_ROLES).toEqual(['ADMIN', 'GANADERO']);
    expect(ALLOWED_ROLES_MESSAGE).toContain('ADMIN');
    expect(ALLOWED_ROLES_MESSAGE).toContain('GANADERO');
  });

  it('should expose ADMIN as the only allowed role for admin routes', () => {
    expect(ADMIN_ONLY_ROLES).toEqual(['ADMIN']);
  });

  it('should expose GANADERO as the only allowed role for ganadero routes', () => {
    expect(GANADERO_ONLY_ROLES).toEqual(['GANADERO']);
  });
});
