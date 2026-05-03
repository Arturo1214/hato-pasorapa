import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GanaderoDashboardService } from './data-access/ganadero-dashboard.service';
import { GanaderoDashboardPageComponent } from './ganadero-dashboard-page.component';

describe('GanaderoDashboardPageComponent', () => {
  let fixture: ComponentFixture<GanaderoDashboardPageComponent>;
  const dashboardService = {
    animalsSummary: signal({
      machos: { vaquillas: 0, vacas: 0, toros: 1, terneros: 1, bueyes: 0 },
      hembras: { vaquillas: 1, vacas: 1, toros: 0, terneros: 2, bueyes: 0 },
    }),
    upcomingEvents: signal([{ id: 'event-1', eventType: 'GENERAL', eventDate: '2026-05-10', description: 'Evento' }]),
    unreadCount: signal(3),
    upcomingVisits: signal([{ id: 'visit-1', controlType: 'FIELD_VET_VISIT', plannedDate: '2026-05-11', status: 'PENDIENTE' }]),
    loadDashboard: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GanaderoDashboardPageComponent],
      providers: [{ provide: GanaderoDashboardService, useValue: dashboardService }],
    }).compileComponents();

    fixture = TestBed.createComponent(GanaderoDashboardPageComponent);
    fixture.detectChanges();
  });

  it('should create the standalone ganadero dashboard and load data once', () => {
    expect(fixture.componentInstance).toBeTruthy();
    expect(dashboardService.loadDashboard).toHaveBeenCalledTimes(1);
  });

  it('should render the four dashboard widgets', () => {
    const widgetCards = fixture.nativeElement.querySelectorAll('[data-testid="dashboard-widget"]');

    expect(widgetCards).toHaveLength(4);
    expect(fixture.nativeElement.querySelector('app-animals-summary-widget')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-upcoming-events-widget')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-unread-notifications-widget')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-upcoming-visits-widget')).not.toBeNull();
  });
});
