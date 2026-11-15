import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { environment } from '../../../environments/environment';
import { RealtimeDatabaseService } from '../../realtime-database.service';
import { UserSessionService } from '../../user-session.service';
import { PlanTripPage } from './plan-trip-page';
import { describe, expect, it, vi } from 'vitest';

type TestSnapshot = { exists: () => boolean; val: () => unknown };
type SnapshotCallback = (snapshot: TestSnapshot) => void;
type ErrorCallback = (error: Error) => void;

describe('PlanTripPage', () => {
  let http: HttpTestingController;
  let receiveSnapshot: SnapshotCallback;
  let receiveError: ErrorCallback;
  let unsubscribe: ReturnType<typeof vi.fn>;
  let subscribe: ReturnType<typeof vi.fn>;
  let navigate: ReturnType<typeof vi.fn>;

  const activity = (
    place: string,
    description: string,
    time: string,
    type?: string,
  ) => ({ place, description, time, ...(type === undefined ? {} : { type }) });

  const bookedTrip = () => ({
    tripId: 'TN-3UP9HH',
    userId: 'jk',
    status: 'booked',
    days: [
      { day: 1, activities: [
        activity('Start Station', 'Board the train', '06:00', 'Transport'),
        activity('Breakfast Cafe', 'Have breakfast', '08:00', 'Meal'),
      ] },
      { day: 2, activities: [
        activity('Hill Hotel', 'Check in', '12:00', 'Accommodation'),
        activity('Town Museum', 'Visit the museum', '15:00', 'Museum'),
      ] },
    ],
  });

  const inProgressTrip = (overrides: Record<string, unknown> = {}) => ({
    ...bookedTrip(),
    tracking: {
      status: 'in_progress',
      currentCheckpointIndex: 0,
      delayTriggered: false,
      driftHrs: 0.5,
      ...overrides,
    },
  });

  const emit = (value: unknown) => receiveSnapshot({
    exists: () => true,
    val: () => value && typeof value === 'object' && 'tripId' in value
      ? { [String(value.tripId)]: value }
      : value,
  });
  const emitTrips = (value: unknown) => receiveSnapshot({ exists: () => true, val: () => value });
  const emitMissing = () => receiveSnapshot({ exists: () => false, val: () => null });

  const createPage = async (): Promise<ComponentFixture<PlanTripPage>> => {
    const fixture = TestBed.createComponent(PlanTripPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  };

  const pageText = (fixture: ComponentFixture<PlanTripPage>) =>
    (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(async () => {
    unsubscribe = vi.fn();
    navigate = vi.fn().mockResolvedValue(true);
    subscribe = vi.fn((_userId: string, next: SnapshotCallback, error: ErrorCallback) => {
      receiveSnapshot = next;
      receiveError = error;
      return unsubscribe;
    });
    await TestBed.configureTestingModule({
      imports: [PlanTripPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Router, useValue: { navigate } },
        {
          provide: RealtimeDatabaseService,
          useValue: { subscribeToTravelerHomeTrip: subscribe },
        },
        {
          provide: UserSessionService,
          useValue: { currentUser: () => ({ userId: 'jk', username: 'jk', name: 'Jamie' }) },
        },
      ],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    TestBed.resetTestingModule();
  });

  it('shows the booked first-activity preview as Planned / Not started without mutating the source record', async () => {
    const record = bookedTrip();
    const before = structuredClone(record);
    const fixture = await createPage();

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith('jk', expect.any(Function), expect.any(Function));
    emit(record);
    fixture.detectChanges();

    expect(pageText(fixture)).toContain('Planned / Not started');
    expect(pageText(fixture)).toContain('Preview activity');
    expect(pageText(fixture)).toContain('travel');
    expect(pageText(fixture)).toContain('Start Station');
    expect(pageText(fixture)).not.toContain('Breakfast Cafe');
    expect(record).toEqual(before);
  });

  it('projects current and next activities from the flattened cursor and applies live updates without reload', async () => {
    const fixture = await createPage();
    emit(inProgressTrip({ currentCheckpointIndex: 0 }));
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Start Station');
    expect(pageText(fixture)).toContain('Breakfast Cafe');

    emit(inProgressTrip({ currentCheckpointIndex: 2 }));
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Hill Hotel');
    expect(pageText(fixture)).toContain('Town Museum');
    expect(pageText(fixture)).not.toContain('Start Station');
  });

  it('maps supported activity categories, preserves unknown types, and displays absent optional fields plainly', async () => {
    const fixture = await createPage();
    const trip = inProgressTrip();
    const days = (trip.days as Array<{ activities: Array<Record<string, unknown>> }>);

    for (const [index, expectedType] of [[0, 'travel'], [1, 'eating'], [2, 'hotel'], [3, 'Museum']] as const) {
      emit(inProgressTrip({ currentCheckpointIndex: index }));
      fixture.detectChanges();
      expect(pageText(fixture)).toContain(expectedType);
    }

    days[0].activities[0] = { place: null, description: undefined, time: null };
    emit({
      ...trip,
      days,
      tracking: { status: 'in_progress', currentCheckpointIndex: 0 },
    });
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Not provided');
    expect(pageText(fixture)).toContain('Delay triggered: Not provided');
    expect(pageText(fixture)).toContain('Drift (hrs): Not provided');
  });

  it('hides missing, wrong-owner, completed, malformed, and invalid-cursor records without fallback trip data', async () => {
    const fixture = await createPage();

    emitMissing();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="traveler-trip-card"]')).toBeNull();

    emit({ ...bookedTrip(), userId: 'someone-else', days: [{ day: 1, activities: [activity('PRIVATE LOCATION', 'Private', 'now')] }] });
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="traveler-trip-card"]')).toBeNull();

    emit(inProgressTrip({ status: 'completed' }));
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="traveler-trip-card"]')).toBeNull();

    for (const invalid of [
      { ...bookedTrip(), days: [null] },
      { ...bookedTrip(), tracking: { status: 'in_progress', currentCheckpointIndex: 0 }, days: [{ day: 1, activities: [null] }] },
      inProgressTrip({ currentCheckpointIndex: 8 }),
      inProgressTrip({ currentCheckpointIndex: -1 }),
      inProgressTrip({ currentCheckpointIndex: 1.5 }),
      { ...bookedTrip(), tripId: 'OTHER-TRIP' },
      { ...bookedTrip(), tracking: { status: 'paused', currentCheckpointIndex: 0 } },
    ]) {
      emit(invalid);
      fixture.detectChanges();
      expect(pageText(fixture)).toContain('Trip unavailable');
      expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="traveler-trip-card"]')).toBeNull();
    }
  });

  it('selects the most recent non-completed trip for the current user only', async () => {
    const fixture = await createPage();
    emitTrips({
      'TN-OLD': { ...bookedTrip(), tripId: 'TN-OLD', createdAt: 10 },
      'TN-NEW': { ...bookedTrip(), tripId: 'TN-NEW', createdAt: 20 },
      'TN-OTHER': {
        ...bookedTrip(),
        tripId: 'TN-OTHER',
        userId: 'someone-else',
        createdAt: 30,
        days: [{ day: 1, activities: [activity('PRIVATE LOCATION', 'Private', 'now')] }],
      },
      'TN-DONE': {
        ...bookedTrip(),
        tripId: 'TN-DONE',
        createdAt: 40,
        tracking: { status: 'completed', currentCheckpointIndex: 0 },
      },
    });
    fixture.detectChanges();

    expect(pageText(fixture)).toContain('Trip TN-NEW');
    expect(pageText(fixture)).not.toContain('TN-OLD');
    expect(pageText(fixture)).not.toContain('PRIVATE LOCATION');
    expect(pageText(fixture)).not.toContain('TN-DONE');
  });

  it('displays delay and drift independently and gates journey motion on explicit on-time status', async () => {
    const fixture = await createPage();
    const host = fixture.nativeElement as HTMLElement;

    emit(inProgressTrip({ delayTriggered: false, driftHrs: 1.25 }));
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Delay triggered: false');
    expect(pageText(fixture)).toContain('Drift (hrs): 1.25');
    expect(pageText(fixture)).toContain('On-time status is confirmed.');
    let marker = host.querySelector('.traveler-journey-marker');
    expect(marker).not.toBeNull();
    expect(pageText(fixture)).toContain('Current: Start Station');
    expect(pageText(fixture)).toContain('Next: Breakfast Cafe');

    emit(inProgressTrip({ delayTriggered: true }));
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Delay triggered: true');
    expect(pageText(fixture)).toContain('Drift (hrs): 0.5');
    expect(pageText(fixture)).toContain('Delay reported. On-time movement is paused.');
    expect(host.querySelector('.traveler-journey-marker')).toBeNull();

    emit(inProgressTrip({ delayTriggered: undefined, driftHrs: 0 }));
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Delay triggered: Not provided');
    expect(pageText(fixture)).toContain('Drift (hrs): 0');
    expect(pageText(fixture)).toContain('On-time status is not provided.');
    marker = host.querySelector('.traveler-journey-marker');
    expect(marker).toBeNull();
  });

  it('keeps the rail labels and visible progress in the component reduced-motion media rule', async () => {
    const fixture = await createPage();
    const record = inProgressTrip({ delayTriggered: false });
    (record.days[0].activities[0] as unknown as Record<string, unknown>)['latitude'] = 17.4;
    (record.days[0].activities[0] as unknown as Record<string, unknown>)['longitude'] = 78.5;
    emit(record);
    fixture.detectChanges();

    const root = (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Journey progress"]');
    expect(root?.textContent).toContain('Current: Start Station');
    expect(root?.textContent).toContain('Next: Breakfast Cafe');
    expect(root?.querySelector('[aria-hidden="true"] .traveler-journey-marker')).not.toBeNull();

    const componentStyle = Array.from(document.querySelectorAll('style'))
      .map((style) => style.textContent ?? '')
      .find((text) => text.includes('traveler-journey-progress'));
    expect(componentStyle).toContain('@media (prefers-reduced-motion: reduce)');
    expect(componentStyle).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*?animation:\s*none\s*!important/);

    const railText = root?.textContent ?? '';
    expect(railText).not.toMatch(/latitude|longitude|coordinates/i);
    expect(railText).not.toContain('17.4');
    expect(railText).not.toContain('78.5');
  });

  it('clears a previously displayed card on listener error and ignores late snapshots after teardown', async () => {
    const fixture = await createPage();
    emit(inProgressTrip());
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Start Station');

    receiveError(new Error('permission denied'));
    fixture.detectChanges();
    expect(pageText(fixture)).toContain('Live trip updates are unavailable');
    expect((fixture.nativeElement as HTMLElement).querySelector('[data-testid="traveler-trip-card"]')).toBeNull();
    expect(pageText(fixture)).not.toContain('Start Station');

    fixture.destroy();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
    expect(() => emit(inProgressTrip({ currentCheckpointIndex: 2, place: 'Late update' }))).not.toThrow();
  });

  // Keep the pre-existing planner regression: the live card must not disrupt validation/chat.
  it('posts the prompt to /travel/validate when Generate My Trip is clicked', async () => {
    const fixture = await createPage();
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
    await fixture.whenStable();
    expect(navigate).toHaveBeenCalledWith(['/itinerary-suggestions']);
  });
});
