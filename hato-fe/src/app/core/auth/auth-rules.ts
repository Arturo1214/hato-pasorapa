import type { Role } from './data-access/auth.service';

export const ALLOWED_ROLES = ['ADMIN', 'GANADERO'] as const satisfies readonly Role[];
export const ADMIN_ONLY_ROLES = ['ADMIN'] as const satisfies readonly Role[];
export const ALLOWED_ROLES_MESSAGE = 'Solo existen roles ADMIN y GANADERO.';
