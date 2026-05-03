import { ComponentFixture, TestBed } from '@angular/core/testing';
import { UnreadNotificationsWidgetComponent } from './unread-notifications-widget.component';

describe('UnreadNotificationsWidgetComponent', () => {
  let fixture: ComponentFixture<UnreadNotificationsWidgetComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [UnreadNotificationsWidgetComponent] }).compileComponents();
    fixture = TestBed.createComponent(UnreadNotificationsWidgetComponent);
  });

  it('should display the unread notifications badge when count is greater than zero', () => {
    fixture.componentRef.setInput('count', 3);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('3');
  });

  it('should hide the badge when count is zero', () => {
    fixture.componentRef.setInput('count', 0);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="unread-count-badge"]')).toBeNull();
  });
});
