import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { NotificationInboxPageComponent } from './notification-inbox.page';

type AdminNotificationsTab = 'administration' | 'creation' | 'history';

@Component({
  selector: 'app-admin-notifications-page',
  imports: [MatCardModule, NotificationInboxPageComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-notifications-page">
      <header>
        <h1>Notificaciones</h1>
      </header>

      <nav class="tabs">
        <button data-testid="admin-notifications-tab" data-tab="administration" type="button" (click)="activeTab.set('administration')">Administración</button>
        <button data-testid="admin-notifications-tab" data-tab="creation" type="button" (click)="activeTab.set('creation')">Creación</button>
        <button data-testid="admin-notifications-tab" data-tab="history" type="button" (click)="activeTab.set('history')">Historial</button>
      </nav>

      @switch (activeTab()) {
        @case ('administration') {
          <mat-card appearance="outlined">
            <h2>Administración</h2>
            <p>Gestioná la operación del inbox y el flujo de notificaciones internas.</p>
          </mat-card>
        }
        @case ('creation') {
          <app-notification-inbox-page [adminMode]="true" />
        }
        @case ('history') {
          <mat-card appearance="outlined">
            <h2>Historial emitido</h2>
            <p>Seguimiento de publicaciones realizadas a los ganaderos activos.</p>
          </mat-card>
        }
      }
    </section>
  `,
})
export class AdminNotificationsPageComponent {
  readonly activeTab = signal<AdminNotificationsTab>('administration');
}
