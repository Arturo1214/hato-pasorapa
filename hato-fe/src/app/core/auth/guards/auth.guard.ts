import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../data-access/auth.service';

export const authGuard: CanActivateFn = (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const sessionStatus = authService.getOfflineSessionStatus();

  if (
    sessionStatus === 'active' &&
    authService.isAuthenticated() &&
    authService.currentUser()?.status === 'ACTIVE'
  ) {
    return true;
  }

  return router.createUrlTree(['/login'], {
    queryParams: {
      session: sessionStatus,
      returnUrl: state.url,
    },
  });
};

export const guestGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/']);
};
