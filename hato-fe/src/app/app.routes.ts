import { Routes } from '@angular/router';
import { ADMIN_ONLY_ROLES, ALLOWED_ROLES } from './core/auth/auth-rules';
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
        path: 'admin/reportes',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/reporting/admin-reporting-page.component').then(
            (m) => m.AdminReportingPageComponent
          ),
      },
      {
        path: 'admin/decision-support',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/decision-support/admin-decision-support-page.component')
            .then((m) => m.AdminDecisionSupportPageComponent)
            .catch(() => import('./features/admin/reporting/admin-reporting-page.component').then((m) => m.AdminReportingPageComponent)),
      },
      {
        path: 'admin/backups',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/backup/backup-page.component').then((m) => m.BackupPageComponent),
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
      {
        path: 'admin/conflictos',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/admin/conflicts/conflict-resolution-page.component').then(
            (m) => m.ConflictResolutionPageComponent
          ),
      },
      {
        path: 'admin/sync-observability',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/sync-observability/sync-observability.component').then((m) => m.SyncObservabilityComponent),
      },
      {
        path: 'admin/animales',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animals-page.component').then(
            (m) => m.AnimalsPageComponent
          ),
      },
      {
        path: 'admin/visitas-veterinarias',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/admin/vet-visits/vet-visits-page.component').then(
            (m) => m.VetVisitsPageComponent
          ),
      },
      {
        path: 'admin/calendario',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/admin/calendar/calendar-page.component').then(
            (m) => m.CalendarPageComponent
          ),
      },
      {
        path: 'admin/notificaciones',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/admin/notifications/notification-inbox.page').then(
            (m) => m.NotificationInboxPageComponent
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
