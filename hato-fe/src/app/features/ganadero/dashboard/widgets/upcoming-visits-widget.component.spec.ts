import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UpcomingVisitsWidgetComponent } from './upcoming-visits-widget.component';

describe('UpcomingVisitsWidgetComponent', () => {
  let fixture: ComponentFixture<UpcomingVisitsWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UpcomingVisitsWidgetComponent] }).compileComponents();
    fixture = TestBed.createComponent(UpcomingVisitsWidgetComponent);
  });

  it('should render visits with control type planned date and status', () => {
    fixture.componentRef.setInput('visits', [
      { id: 'visit-1', controlType: 'FIELD_VET_VISIT', plannedDate: '2026-05-11', status: 'PENDIENTE' },
    ]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('FIELD_VET_VISIT');
    expect(fixture.nativeElement.textContent).toContain('2026-05-11');
    expect(fixture.nativeElement.textContent).toContain('PENDIENTE');
  });

  it('should show empty state when there are no visits', () => {
    fixture.componentRef.setInput('visits', []);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay controles próximos');
  });
});
