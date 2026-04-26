import { CommonModule } from '@angular/common';
import { Component, computed, inject, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatTooltipModule } from '@angular/material/tooltip';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../../core/auth/data-access/auth.service';

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
    ];
  });
}
