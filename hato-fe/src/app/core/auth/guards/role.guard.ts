import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, type Role } from '../data-access/auth.service';

export const roleGuard = (allowedRoles: Role[]): CanActivateFn => () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const user = authService.currentUser();

  if (user && user.status === 'ACTIVE' && allowedRoles.includes(user.role)) {
    return true;
  }

  return router.createUrlTree(['/login']);
};
