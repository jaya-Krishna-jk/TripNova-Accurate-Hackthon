import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TravelApiService } from './travel-api.service';
import { TravelRequest } from '../models/travel.models';

describe('TravelApiService', () => {
  let service: TravelApiService;
  let http: HttpTestingController;

  const sampleRequest: TravelRequest = {
    source: 'Hyderabad',
    destination: 'Ooty',
    startDate: '2025-12-16',
    endDate: '2025-12-20',
    travellerCount: 4,
    travellerType: 'Family',
    budget: 60000,
    mealPreference: 'Veg',
    childrenCount: 2,
    seniorCitizenCount: 0,
    preferences: [],
    hotelPreference: '3 Star Hotel',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TravelApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the trimmed message to /travel/validate', () => {
    service.validate('  Plan a 5-day family trip to Ooty  ').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/travel/validate`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Plan a 5-day family trip to Ooty' });
    req.flush({ isValid: true, missingFields: [], extractedData: {} });
  });

  it('posts a TravelRequest to /travel/chat', () => {
    service.chat(sampleRequest).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/travel/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(sampleRequest);
    req.flush({});
  });

  it('posts the selected plan to /travel/plan-details', () => {
    const request = {
      planId: '2',
      planType: 'Comfort First',
      planName: 'Ooty Family Explorer',
      source: 'Hyderabad',
      destination: 'Ooty',
      durationDays: 4,
      summary: {
        description: '',
        estimatedCost: 52000,
        transportMode: 'Private cab',
        hotelCategory: '3 Star Hotel',
        bestFor: 'Families',
      },
      highlights: [],
    };
    service.planDetails(request).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/travel/plan-details`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({});
  });

  it('maps a network failure to a backend-unreachable message', () => {
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    expect(service.getErrorMessage(error)).toContain('Could not reach the TripNova API');
  });
});
