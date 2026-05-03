import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpcomingEventsWidgetComponent } from './upcoming-events-widget.component';

describe('UpcomingEventsWidgetComponent', () => {
  let fixture: ComponentFixture<UpcomingEventsWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UpcomingEventsWidgetComponent] }).compileComponents();
    fixture = TestBed.createComponent(UpcomingEventsWidgetComponent);
  });

  it('should render event items with type date and description', () => {
    fixture.componentRef.setInput('events', [{ id: 'event-1', eventType: 'GENERAL', eventDate: '2026-05-10', description: 'Evento próximo' }]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('GENERAL');
    expect(fixture.nativeElement.textContent).toContain('2026-05-10');
    expect(fixture.nativeElement.textContent).toContain('Evento próximo');
  });

  it('should show an empty state when there are no events', () => {
    fixture.componentRef.setInput('events', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay eventos próximos');
  });
});
