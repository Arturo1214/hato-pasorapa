import type { Routes } from '@angular/router';
import { ADMIN_ONLY_ROLES, ALLOWED_ROLES, GANADERO_ONLY_ROLES } from './core/auth/auth-rules';
import { authGuard, guestGuard } from './core/auth/guards/auth.guard';
import { roleRedirectGuard } from './core/auth/guards/role-redirect.guard';
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
        pathMatch: 'full',
        canActivate: [roleRedirectGuard],
        loadComponent: () =>
          import('./core/auth/guards/role-redirect-page.component').then(
            (m) => m.RoleRedirectPageComponent,
          ),
      },
      {
        path: 'perfil',
        canActivate: [roleGuard([...ALLOWED_ROLES])],
        loadComponent: () =>
          import('./features/admin/profile/profile-page.component').then(
            (m) => m.ProfilePageComponent,
          ),
        data: {
          title: 'Perfil',
          subtitle: 'Completá tus datos y actualizá tu contraseña con control propio.',
        },
      },
      {
        path: 'admin/dashboard',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/dashboard/admin-dashboard-page.component').then(
            (m) => m.AdminDashboardPageComponent,
          ),
        data: {
          title: 'Panel',
          subtitle: 'Seguimiento rápido de usuarios, rodeo y estado operativo del establecimiento.',
        },
      },
      {
        path: 'admin/reportes',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/reporting/admin-reporting-page.component').then(
            (m) => m.AdminReportingPageComponent,
          ),
        data: {
          title: 'Reportes',
          subtitle:
            'Indicadores agregados para productividad, costos, frescura y actividad reciente.',
        },
      },
      {
        path: 'admin/decision-support',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/decision-support/admin-decision-support-page.component')
            .then((m) => m.AdminDecisionSupportPageComponent)
            .catch(() =>
              import('./features/admin/reporting/admin-reporting-page.component').then(
                (m) => m.AdminReportingPageComponent,
              ),
            ),
        data: {
          title: 'Soporte de decisiones',
          subtitle:
            'Análisis administrativo para priorizar acciones con respaldo de métricas operativas.',
        },
      },
      {
        path: 'admin/usuarios',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/users/admin-users-page.component').then(
            (m) => m.AdminUsersPageComponent,
          ),
        data: {
          title: 'Usuarios',
          subtitle: 'Gestioná accesos, roles y estados del equipo del establecimiento.',
        },
      },
      {
        path: 'admin/ganaderos',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/ganaderos/ganaderos-page.component').then(
            (m) => m.GanaderosPageComponent,
          ),
        data: {
          title: 'Ganaderos',
          subtitle: 'Administrá el padrón, el alta operativa y los accesos temporales del campo.',
        },
      },
      {
        path: 'admin/razas',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/razas/razas-page.component').then((m) => m.RazasPageComponent),
        data: {
          title: 'Razas',
          subtitle:
            'Administrá el catálogo de razas disponible para la carga operativa de animales.',
        },
      },
      {
        path: 'admin/conflictos',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/conflicts/conflict-resolution-page.component').then(
            (m) => m.ConflictResolutionPageComponent,
          ),
        data: {
          title: 'Conflictos',
          subtitle:
            'Revisá diferencias entre local y servidor para decidir cómo cerrar cada operación.',
        },
      },
      {
        path: 'admin/notificaciones',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/notifications/admin-notifications-page.component').then(
            (m) => m.AdminNotificationsPageComponent,
          ),
        data: {
          title: 'Notificaciones',
          subtitle: 'Creá avisos internos y revisá el historial emitido con métricas de lectura.',
        },
      },
      {
        path: 'admin/animales',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animals-page.component').then(
            (m) => m.AnimalsPageComponent,
          ),
        data: {
          title: 'Animales',
          subtitle: 'Consultá y actualizá el rodeo con foco en la operación diaria del campo.',
        },
      },
      {
        path: 'admin/animales/nuevo',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animal-form-page.component').then(
            (m) => m.AnimalFormPageComponent,
          ),
        data: {
          title: 'Nuevo animal',
          subtitle:
            'Registrá una ficha animal con propietario, datos operativos y genealogía básica.',
        },
      },
      {
        path: 'admin/animales/:uuid/editar',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animal-form-page.component').then(
            (m) => m.AnimalFormPageComponent,
          ),
        data: {
          title: 'Editar animal',
          subtitle: 'Actualizá la ficha animal, imágenes y vínculos de padre/madre.',
        },
      },
      {
        path: 'admin/animales/:uuid',
        canActivate: [roleGuard([...ADMIN_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animal-detail-page.component').then(
            (m) => m.AnimalDetailPageComponent,
          ),
        data: {
          title: 'Ficha animal',
          subtitle: 'Detalle operativo, imágenes, historial y genealogía del animal.',
        },
      },
      {
        path: 'ganadero/dashboard',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/ganadero/dashboard/ganadero-dashboard-page.component').then(
            (m) => m.GanaderoDashboardPageComponent,
          ),
        data: {
          title: 'Panel',
          subtitle: 'Resumen operativo del ganadero con animales, eventos y visitas próximas.',
        },
      },
      {
        path: 'ganadero/animales',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animals-page.component').then(
            (m) => m.AnimalsPageComponent,
          ),
        data: {
          title: 'Animales',
          subtitle: 'Consultá y actualizá tu rodeo con foco en la operación diaria del campo.',
        },
      },
      {
        path: 'ganadero/animales/nuevo',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animal-form-page.component').then(
            (m) => m.AnimalFormPageComponent,
          ),
        data: {
          title: 'Nuevo animal',
          subtitle: 'Registrá un animal propio con datos operativos y genealogía básica.',
        },
      },
      {
        path: 'ganadero/animales/:uuid/editar',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animal-form-page.component').then(
            (m) => m.AnimalFormPageComponent,
          ),
        data: {
          title: 'Editar animal',
          subtitle: 'Actualizá la ficha de tu animal, imágenes y vínculos de padre/madre.',
        },
      },
      {
        path: 'ganadero/animales/:uuid',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/animals/animal-detail-page.component').then(
            (m) => m.AnimalDetailPageComponent,
          ),
        data: {
          title: 'Ficha animal',
          subtitle: 'Detalle operativo, imágenes, historial y genealogía de tu animal.',
        },
      },
      {
        path: 'ganadero/visitas',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/vet-visits/vet-visits-page.component').then(
            (m) => m.VetVisitsPageComponent,
          ),
        data: {
          title: 'Visitas veterinarias',
          subtitle: 'Seguimiento de controles clínicos y próximas acciones sanitarias del campo.',
        },
      },
      {
        path: 'ganadero/calendario',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/admin/calendar/calendar-page.component').then(
            (m) => m.CalendarPageComponent,
          ),
        data: {
          title: 'Calendario',
          subtitle: 'Agenda de eventos y vencimientos propios del ganadero autenticado.',
        },
      },
      {
        path: 'ganadero/notificaciones',
        canActivate: [roleGuard([...GANADERO_ONLY_ROLES])],
        loadComponent: () =>
          import('./features/ganadero/notifications/ganadero-inbox-page.component').then(
            (m) => m.GanaderoInboxPageComponent,
          ),
        data: {
          title: 'Notificaciones',
          subtitle: 'Bandeja de avisos recibidos con lectura y seguimiento operativo.',
        },
      },
      {
        path: 'ganadero/sincronizacion',
        redirectTo: 'ganadero/dashboard',
        pathMatch: 'full',
      },
      {
        path: 'ganadero/backups',
        redirectTo: 'ganadero/dashboard',
        pathMatch: 'full',
      },
      {
        path: 'ganadero/conflictos',
        redirectTo: 'ganadero/dashboard',
        pathMatch: 'full',
      },
      {
        path: '403',
        loadComponent: () =>
          import('./core/auth/guards/forbidden-page.component').then(
            (m) => m.ForbiddenPageComponent,
          ),
        data: {
          title: 'Acceso denegado',
          subtitle: 'Tu usuario no tiene permisos para esta sección.',
        },
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
            (m) => m.LoginPageComponent,
          ),
      },
      {
        path: 'registro',
        loadComponent: () =>
          import('./features/public/ganadero-registration-page/ganadero-registration-page.component').then(
            (m) => m.GanaderoRegistrationPageComponent,
          ),
      },
      {
        path: 'admin/bootstrap',
        loadComponent: () =>
          import('./features/admin/bootstrap/bootstrap-page/bootstrap-page.component').then(
            (m) => m.BootstrapPageComponent,
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
