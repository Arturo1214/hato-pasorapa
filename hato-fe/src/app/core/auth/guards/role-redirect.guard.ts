import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../data-access/auth.service';

export const roleRedirectGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const role = authService.currentUser()?.role;

  if (role === 'GANADERO') {
    return router.createUrlTree(['/ganadero/dashboard']);
  }

  return router.createUrlTree(['/admin/dashboard']);
};
