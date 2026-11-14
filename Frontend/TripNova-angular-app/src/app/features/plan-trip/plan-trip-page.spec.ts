import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PlanTripPage } from './plan-trip-page';

describe('PlanTripPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanTripPage],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the prompt to /travel/validate when Generate My Trip is clicked', async () => {
    const fixture = TestBed.createComponent(PlanTripPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-testid="generate-trip"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    const req = http.expectOne(`${environment.apiBaseUrl}/travel/validate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.message.length).toBeGreaterThan(0);
    req.flush({
      isValid: true,
      missingFields: [],
      extractedData: {
        source: 'Hyderabad', destination: 'Ooty',
        startDate: '2025-12-16', endDate: '2025-12-20',
        travellerCount: 4, travellerType: 'Family',
        budget: 60000, mealPreference: 'Veg',
        childrenCount: 2, seniorCitizenCount: 0,
      },
    });

    await fixture.whenStable();

    const chatReq = http.expectOne(`${environment.apiBaseUrl}/travel/chat`);
    expect(chatReq.request.method).toBe('POST');
    expect(chatReq.request.body.source).toBe('Hyderabad');
    chatReq.flush({});
  });
});
