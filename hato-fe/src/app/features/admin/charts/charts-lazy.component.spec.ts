import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartsLazyComponent } from './charts-lazy.component';

describe('ChartsLazyComponent', () => {
  let fixture: ComponentFixture<ChartsLazyComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChartsLazyComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ChartsLazyComponent);
    fixture.componentRef.setInput('metrics', {
      admins: { total: 2, active: 2, inactive: 0, blocked: 0 },
      ganaderos: { total: 5, active: 4, inactive: 1, blocked: 0 },
    });
    fixture.detectChanges();
  });

  it('should render the bar and doughnut chart containers', () => {
    const canvases = fixture.nativeElement.querySelectorAll('canvas');

    expect(fixture.nativeElement.textContent).toContain('Usuarios por rol');
    expect(fixture.nativeElement.textContent).toContain('Estado de ganaderos');
    expect(canvases).toHaveLength(2);
  });
});
