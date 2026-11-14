import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { PlanTripPage } from './plan-trip-page';

describe('PlanTripPage', () => {
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlanTripPage],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the prompt to /travel/chat when Generate My Trip is clicked', async () => {
    const fixture = TestBed.createComponent(PlanTripPage);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('[data-testid="generate-trip"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    const req = http.expectOne(`${environment.apiBaseUrl}/travel/chat`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body.message.length).toBeGreaterThan(0);
    req.flush({});
  });
});
