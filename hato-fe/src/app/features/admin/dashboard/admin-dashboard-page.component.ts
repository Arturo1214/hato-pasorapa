import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { AdminDashboardMetrics, AdminDashboardService } from './data-access/admin-dashboard.service';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [CommonModule, MatCardModule],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Dashboard</h1>
        <p>Resumen mínimo de usuarios del sistema para administración.</p>
      </header>

      @if (errorMessage()) {
        <mat-card appearance="outlined">
          <p>{{ errorMessage() }}</p>
        </mat-card>
      } @else if (metrics()) {
        <div class="metrics-grid">
          <mat-card appearance="outlined">
            <h2>Administradores</h2>
            <p>Total: {{ metrics()!.admins.total }}</p>
            <p>Activos: {{ metrics()!.admins.active }}</p>
            <p>De baja: {{ metrics()!.admins.inactive }}</p>
            <p>Bloqueados: {{ metrics()!.admins.blocked }}</p>
          </mat-card>

          <mat-card appearance="outlined">
            <h2>Ganaderos usuario</h2>
            <p>Total: {{ metrics()!.ganaderos.total }}</p>
            <p>Activos: {{ metrics()!.ganaderos.active }}</p>
            <p>De baja: {{ metrics()!.ganaderos.inactive }}</p>
            <p>Bloqueados: {{ metrics()!.ganaderos.blocked }}</p>
          </mat-card>
        </div>
      }
    </section>
  `,
  styles: [
    `
      .admin-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .page-header h1,
      h2 {
        margin: 0 0 0.5rem;
      }

      .metrics-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }
    `,
  ],
})
export class AdminDashboardPageComponent {
  private readonly dashboardService = inject(AdminDashboardService);

  readonly metrics = signal<AdminDashboardMetrics | null>(null);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.dashboardService.loadMetrics().subscribe({
      next: (metrics) => this.metrics.set(metrics),
      error: () => this.errorMessage.set('No pudimos cargar el dashboard administrativo.'),
    });
  }
}
