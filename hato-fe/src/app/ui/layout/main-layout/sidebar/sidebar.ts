import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, output } from '@angular/core';
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
import { BrandLockupComponent } from '../../../../shared/ui/brand-lockup/brand-lockup.component';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  description: string;
  badge?: number;
  severity?: string | null;
}

interface StaticMenuItem {
  label: string;
  icon: string;
  route: string;
  description: string;
  badgeKey?: 'conflicts' | 'calendar';
}

const ADMIN_MENU_ITEMS: StaticMenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'space_dashboard',
    route: '/admin/dashboard',
    description: 'Resumen administrativo para seguir métricas y prioridades del establecimiento.',
  },
  {
    label: 'Usuarios',
    icon: 'manage_accounts',
    route: '/admin/usuarios',
    description: 'Alta, edición y control de acceso para el equipo del establecimiento.',
  },
  {
    label: 'Ganaderos',
    icon: 'groups',
    route: '/admin/ganaderos',
    description: 'Padrón ganadero con seguimiento administrativo y soporte operativo.',
  },
  {
    label: 'Razas',
    icon: 'cruelty_free',
    route: '/admin/razas',
    description: 'Catálogo de razas disponible para el registro operativo del rodeo.',
  },
  {
    label: 'Notificaciones',
    icon: 'notifications',
    route: '/admin/notificaciones',
    description: 'Administrá envíos, creación e historial de notificaciones internas.',
  },
  {
    label: 'Reportes',
    icon: 'analytics',
    route: '/admin/reportes',
    description: 'Indicadores agregados para productividad, costos y decisiones operativas.',
  },
];

const GANADERO_MENU_ITEMS: StaticMenuItem[] = [
  {
    label: 'Dashboard',
    icon: 'space_dashboard',
    route: '/ganadero/dashboard',
    description: 'Resumen diario del trabajo de campo con foco en tus animales y alertas.',
  },
  {
    label: 'Animales',
    icon: 'pets',
    route: '/ganadero/animales',
    description: 'Consultá y actualizá tu rodeo para sostener la operación diaria.',
  },
  {
    label: 'Visitas veterinarias',
    icon: 'vaccines',
    route: '/ganadero/visitas',
    description: 'Seguimiento de controles, visitas y observaciones clínicas del campo.',
  },
  {
    label: 'Calendario',
    icon: 'calendar_month',
    route: '/ganadero/calendario',
    description: 'Agenda de tareas y recordatorios para no perder acciones clave del campo.',
    badgeKey: 'calendar',
  },
  {
    label: 'Notificaciones',
    icon: 'notifications',
    route: '/ganadero/notificaciones',
    description: 'Bandeja de avisos recibidos con seguimiento de lectura y prioridades.',
  },
];

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
    BrandLockupComponent,
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarComponent {
  readonly authService = inject(AuthService);
  readonly appConfig = inject(ApplicationConfigService);
  readonly calendarAlertsStore = inject(CalendarAlertsStore);
  readonly conflictResolutionStore = inject(AdminConflictResolutionStore);
  readonly navigate = output<void>();

  readonly menuItems = computed(() =>
    (this.authService.currentUser()?.role === 'ADMIN' ? ADMIN_MENU_ITEMS : GANADERO_MENU_ITEMS).map((item) =>
      this.enrichMenuItem(item)
    )
  );

  private enrichMenuItem(item: StaticMenuItem): MenuItem {
    switch (item.badgeKey) {
      case 'conflicts': {
        const badge = this.conflictResolutionStore.unresolvedCount();
        return { ...item, badge, severity: badge > 0 ? 'high' : null };
      }
      case 'calendar':
        return {
          ...item,
          badge: this.calendarAlertsStore.totalPending(),
          severity: this.calendarAlertsStore.badgeSeverity(),
        };
      default:
        return item;
    }
  }
}
