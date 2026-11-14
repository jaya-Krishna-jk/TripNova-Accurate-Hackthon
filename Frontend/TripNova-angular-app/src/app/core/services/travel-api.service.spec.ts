import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { TravelApiService } from './travel-api.service';

describe('TravelApiService', () => {
  let service: TravelApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(TravelApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the trimmed message to /travel/chat', () => {
    service.chat('  Plan a 5-day family trip to Ooty  ').subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/travel/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ message: 'Plan a 5-day family trip to Ooty' });
    req.flush({});
  });

  it('maps a network failure to a backend-unreachable message', () => {
    const error = new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' });
    expect(service.getErrorMessage(error)).toContain('Could not reach the TripNova API');
  });
});
