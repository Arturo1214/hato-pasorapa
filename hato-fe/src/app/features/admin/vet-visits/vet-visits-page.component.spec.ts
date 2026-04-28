import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { VetVisitsPageComponent } from './vet-visits-page.component';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { ActivatedRoute } from '@angular/router';

describe('VetVisitsPageComponent', () => {
  const createHealthEventsServiceMock = () => ({
    listEvents: vi.fn(() => of([])),
    createEvent: vi.fn(() => of({ outcome: 'queued', message: 'Evento sanitario encolado. Se disparó la sincronización automática.' })),
  });

  const configure = async (healthEventsServiceMock = createHealthEventsServiceMock()) => {
    await TestBed.configureTestingModule({
      imports: [VetVisitsPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ animalUuid: 'animal-1' }),
            },
          },
        },
        {
          provide: AnimalsHealthEventsService,
          useValue: healthEventsServiceMock,
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(VetVisitsPageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance, healthEventsServiceMock };
  };

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.restoreAllMocks();
  });

  it('should require mandatory veterinary fields and nextDueAt for FOLLOW_UP_REQUIRED', async () => {
    const { fixture, component, healthEventsServiceMock } = await configure();

    component.form.patchValue({
      animalUuid: 'animal-1',
      visitId: 'visit-1',
      occurredAt: '2026-04-26T10:00',
      protocolStatus: 'FOLLOW_UP_REQUIRED',
      reason: '',
      findings: '',
      plan: '',
      nextDueAt: '',
    });
    component.submitForm();
    fixture.detectChanges();

    expect(component.form.invalid).toBe(true);
    expect(component.showProtocolError()).toBe(true);
    expect(healthEventsServiceMock.createEvent).not.toHaveBeenCalled();
  });

  it('should render the fixed checklist catalog and submit typed metadata from the separated page', async () => {
    const { fixture, component, healthEventsServiceMock } = await configure();

    component.form.patchValue({
      animalUuid: 'animal-1',
      visitId: 'visit-1',
      occurredAt: '2026-04-26T10:00',
      protocolStatus: 'FOLLOW_UP_REQUIRED',
      nextDueAt: '2026-04-28T10:00',
      reason: 'Control',
      findings: 'Leve fiebre',
      plan: 'Seguir',
    });
    component.submitForm();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('GENERAL_APPEARANCE');
    expect(fixture.nativeElement.textContent).toContain('TEMPERATURE');
    expect(fixture.nativeElement.textContent).toContain('LOCOMOTION');
    expect(healthEventsServiceMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        animalUuid: 'animal-1',
        healthEventType: 'FIELD_VET_VISIT',
        metadata: expect.objectContaining({
          visit: expect.objectContaining({ visitId: 'visit-1' }),
          protocol: expect.objectContaining({ status: 'FOLLOW_UP_REQUIRED' }),
        }),
      })
    );
  });
});
