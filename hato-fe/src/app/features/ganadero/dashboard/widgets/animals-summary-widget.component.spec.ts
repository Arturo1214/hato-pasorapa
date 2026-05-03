import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AnimalsSummaryWidgetComponent } from './animals-summary-widget.component';

describe('AnimalsSummaryWidgetComponent', () => {
  let fixture: ComponentFixture<AnimalsSummaryWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AnimalsSummaryWidgetComponent] }).compileComponents();
    fixture = TestBed.createComponent(AnimalsSummaryWidgetComponent);
    fixture.componentRef.setInput('summary', {
      machos: { vaquillas: 0, vacas: 0, toros: 2, terneros: 1, bueyes: 0 },
      hembras: { vaquillas: 1, vacas: 3, toros: 0, terneros: 2, bueyes: 0 },
    });
    fixture.detectChanges();
  });

  it('should display males and females grid rows', () => {
    expect(fixture.nativeElement.textContent).toContain('Machos');
    expect(fixture.nativeElement.textContent).toContain('Hembras');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="animals-summary-row"]')).toHaveLength(5);
  });
});
