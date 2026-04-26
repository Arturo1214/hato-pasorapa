import { Routes } from '@angular/router';
import { ADMIN_ONLY_ROLES } from './core/auth/auth-rules';
import { authGuard, guestGuard } from './core/auth/guards/auth.guard';
import { roleGuard } from './core/auth/guards/role.guard';
import { PublicLayout } from './ui/layout/public-layout/public-layout';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./ui/layout/main-layout/main-layout').then((m) => m.MainLayout),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./ui/home/home.component').then((m) => m.HomeComponent),
        data: {
          title: 'Inicio',
          subtitle: 'Proyecto base de Hato listo para conectar con backend.',
        },
      },
      {
        path: 'admin/dashboard',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard-page.component').then(
            (m) => m.AdminDashboardPageComponent
          ),
      },
      {
        path: 'admin/usuarios',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/users/admin-users-page.component').then(
            (m) => m.AdminUsersPageComponent
          ),
      },
      {
        path: 'admin/ganaderos',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/ganaderos/ganaderos-page.component').then(
            (m) => m.GanaderosPageComponent
          ),
      },
    ],
  },
  {
    path: '',
    component: PublicLayout,
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/admin/auth/login-page/login-page.component').then(
            (m) => m.LoginPageComponent
          ),
      },
      {
        path: 'admin/bootstrap',
        loadComponent: () =>
          import('./features/admin/bootstrap/bootstrap-page/bootstrap-page.component').then(
            (m) => m.BootstrapPageComponent
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: '',
    pathMatch: 'full',
  },
];
