import { CommonModule } from '@angular/common';
import { Component, computed, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { CalendarAlertsStore } from '../../../../features/admin/calendar/data-access/calendar-alerts.store';
import { AdminConflictResolutionStore } from '../../../../features/admin/conflicts/data-access/admin-conflict-resolution.store';
import { NotificationInboxStore } from '../../../../features/admin/notifications/data-access/notification-inbox.store';

@Component({
  selector: 'app-sidebar',
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatDividerModule,
    MatIconModule,
    MatListModule,
    MatTooltipModule,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  readonly appConfig = inject(ApplicationConfigService);
  readonly calendarAlertsStore = inject(CalendarAlertsStore);
  readonly conflictResolutionStore = inject(AdminConflictResolutionStore);
  readonly notificationInboxStore = inject(NotificationInboxStore);
  readonly navigate = output<void>();

  readonly menuItems = computed(() => {
    const role = this.authService.currentUser()?.role;

    return [
      {
        label: 'Inicio',
        icon: 'space_dashboard',
        route: '/',
        description:
          role === 'ADMIN'
            ? 'Resumen inicial para administración y operación.'
            : 'Resumen inicial para trabajo de ganadería.',
      },
      ...(role === 'ADMIN'
        ? [
            {
              label: 'Dashboard',
              icon: 'insights',
              route: '/admin/dashboard',
              description: 'Métricas mínimas de usuarios y seguimiento administrativo.',
            },
            {
              label: 'Reportes',
              icon: 'analytics',
              route: '/admin/reportes',
              description: 'Métricas operativas offline-first con presets y frescura visible.',
            },
            ...(this.appConfig.config().offlineBackupV1Enabled
              ? [
                  {
                    label: 'Backups',
                    icon: 'save',
                    route: '/admin/backups',
                    description: 'Export/import local con restore transaccional y digest verificable.',
                  },
                ]
              : []),
            {
              label: 'Usuarios',
              icon: 'manage_accounts',
              route: '/admin/usuarios',
              description: 'Alta, baja y reseteo básico de usuarios del sistema.',
            },
            {
              label: 'Ganaderos',
              icon: 'groups',
              route: '/admin/ganaderos',
              description: 'Registro y gestión mínima de ganaderos.',
            },
          ]
        : []),
      {
        label: 'Conflictos',
        icon: 'rule',
        route: '/admin/conflictos',
        description: 'Resolución manual offline-first con diff visual y auditoría append-only.',
        badge: this.conflictResolutionStore.unresolvedCount(),
        severity: this.conflictResolutionStore.unresolvedCount() > 0 ? 'high' : null,
      },
      {
        label: 'Calendario',
        icon: 'calendar_month',
        route: '/admin/calendario',
        description: 'Agenda local con alertas offline y badge operativo.',
        badge: this.calendarAlertsStore.totalPending(),
        severity: this.calendarAlertsStore.badgeSeverity(),
      },
      {
        label: 'Notificaciones',
        icon: 'notifications',
        route: '/admin/notificaciones',
        description: 'Inbox local con leídas/no leídas por dispositivo.',
        badge: this.notificationInboxStore.unreadCount(),
        severity: this.notificationInboxStore.badgeSeverity(),
      },
      {
        label: 'Sync observability',
        icon: 'sync_alt',
        route: '/admin/sync-observability',
        description: 'Runtime local + histórico agregado con el mismo diccionario de métricas.',
      },
      {
        label: 'Animales',
        icon: 'pets',
        route: '/admin/animales',
        description:
          role === 'ADMIN'
            ? 'Ficha vigente, ownership actual y visibles operativos del rodeo.'
            : 'Consulta y actualización operativa de la ficha vigente del rodeo.',
      },
      {
        label: 'Visitas veterinarias',
        icon: 'vaccines',
        route: '/admin/visitas-veterinarias',
        description: 'Checklist, nota clínica y protocolo de visitas de campo offline-first.',
      },
    ];
  });
}
