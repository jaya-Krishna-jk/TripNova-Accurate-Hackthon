import '@angular/compiler';
import { describe, expect, it, vi } from 'vitest';
import { RealtimeDatabaseService, TripRecord } from '../realtime-database.service';
import { TravelMockComponent } from './travel-mock.component';

const tripRecord: TripRecord = {
  tripId: '111',
  userId: 'jk',
  days: [
    { day: 1, theme: 'Departure', activities: [
      { time: '06:00 AM', place: 'Hyderabad Bus Station', description: 'Depart for Thirupathi' },
      { time: '02:00 PM', place: 'Enroute', description: 'Stop for lunch' },
    ] },
  ],
};

function createComponent() {
  const database = {
    loadTrip: vi.fn(),
    updateTripTracking: vi.fn(),
  };
  const component = new TravelMockComponent(database as unknown as RealtimeDatabaseService);
  return { component, database };
}

describe('TravelMockComponent Firebase trip flow', () => {
  it('does not query Firebase when the trip ID is empty', async () => {
    const { component, database } = createComponent();

    await component.loadTrip();

    expect(database.loadTrip).not.toHaveBeenCalled();
    expect(component.trip()).toBeNull();
    expect(component.decision()).toContain('Enter a trip ID');
  });

  it('shows no trip for an unknown ID', async () => {
    const { component, database } = createComponent();
    component.tripId = '404';
    database.loadTrip.mockResolvedValue({ kind: 'not-found' });

    await component.loadTrip();

    expect(database.loadTrip).toHaveBeenCalledWith('404');
    expect(component.trip()).toBeNull();
    expect(component.notFound()).toBe(true);
  });

  it('loads the Firebase itinerary and derives the current checkpoint', async () => {
    const { component, database } = createComponent();
    component.tripId = '111';
    database.loadTrip.mockResolvedValue({ kind: 'found', trip: tripRecord });

    await component.loadTrip();

    expect(component.trip()).toEqual(tripRecord);
    expect(component.getTripTitle()).toBe('Trip 111');
    expect(component.getCurrentCheckpoint()).toMatchObject({ location: 'Hyderabad Bus Station', expectedTime: '06:00 AM' });
    expect(component.tripStatus()).toBe('not_started');
  });

  it('persists start and resumes a previously started trip without starting it again', async () => {
    const { component, database } = createComponent();
    component.tripId = '111';
    database.loadTrip.mockResolvedValue({ kind: 'found', trip: tripRecord });
    const started: TripRecord = {
      ...tripRecord,
      tracking: {
        status: 'in_progress', currentCheckpointIndex: 0, driftHrs: 0, startedAt: 123,
        lastEvent: { id: 'start-1', type: 'started', checkpointIndex: 0, occurredAt: 123 },
      },
    };
    database.updateTripTracking.mockResolvedValue({ kind: 'committed', trip: started });
    await component.loadTrip();
    component.tripId = '222';

    await component.startTrip();
    await component.startTrip();

    expect(database.updateTripTracking).toHaveBeenCalledTimes(1);
    expect(database.updateTripTracking).toHaveBeenCalledWith('111', { type: 'start' });
    expect(component.tripStatus()).toBe('in_progress');
  });

  it('submits delay in hours and uses the committed tracking value', async () => {
    const { component, database } = createComponent();
    component.tripId = '111';
    const started: TripRecord = {
      ...tripRecord,
      tracking: {
        status: 'in_progress', currentCheckpointIndex: 0, driftHrs: 0, startedAt: 123,
        lastEvent: { id: 'start-1', type: 'started', checkpointIndex: 0, occurredAt: 123 },
      },
    };
    const delayed: TripRecord = {
      ...started,
      tracking: {
        ...started.tracking!, currentCheckpointIndex: 1, driftHrs: 0.75,
        lastEvent: { id: 'delay-1', type: 'delayed', checkpointIndex: 0, occurredAt: 124, delayHrs: 0.75 },
      },
    };
    database.loadTrip.mockResolvedValue({ kind: 'found', trip: started });
    database.updateTripTracking.mockResolvedValue({ kind: 'committed', trip: delayed });
    await component.loadTrip();
    component.delayHours = 0.75;

    await component.recordDecision('delayed');

    expect(database.updateTripTracking).toHaveBeenCalledWith('111', {
      type: 'delayed', delayHrs: 0.75, expectedStatus: 'in_progress', expectedCheckpointIndex: 0,
    });
    expect(component.getDriftHours()).toBe(0.75);
    expect(component.getCurrentCheckpoint().title).toBe('Delayed');
  });

  it('requires a reload after an ambiguous save failure', async () => {
    const { component, database } = createComponent();
    component.tripId = '111';
    const started: TripRecord = {
      ...tripRecord,
      tracking: {
        status: 'in_progress', currentCheckpointIndex: 0, driftHrs: 0, startedAt: 123,
        lastEvent: { id: 'start-1', type: 'started', checkpointIndex: 0, occurredAt: 123 },
      },
    };
    database.loadTrip.mockResolvedValue({ kind: 'found', trip: started });
    database.updateTripTracking.mockRejectedValue(new Error('Network unavailable'));
    await component.loadTrip();

    await component.recordDecision('caught');
    await component.recordDecision('caught');

    expect(component.refreshRequired()).toBe(true);
    expect(database.updateTripTracking).toHaveBeenCalledTimes(1);
    expect(database.updateTripTracking).toHaveBeenCalledWith('111', expect.anything());
  });

  it('does not submit actions for an already completed trip', async () => {
    const { component, database } = createComponent();
    component.tripId = '111';
    const completed: TripRecord = {
      ...tripRecord,
      tracking: {
        status: 'completed', currentCheckpointIndex: 1, driftHrs: 0, startedAt: 123, completedAt: 124,
        lastEvent: { id: 'complete-1', type: 'completed', checkpointIndex: 1, occurredAt: 124, outcome: 'on_time' },
      },
    };
    database.loadTrip.mockResolvedValue({ kind: 'found', trip: completed });
    await component.loadTrip();

    await component.startTrip();

    expect(component.tripStatus()).toBe('completed');
    expect(database.updateTripTracking).not.toHaveBeenCalled();
  });

  it('keeps database errors distinct from not-found', async () => {
    const { component, database } = createComponent();
    component.tripId = '111';
    database.loadTrip.mockRejectedValue(new Error('Permission denied'));

    await component.loadTrip();

    expect(component.notFound()).toBe(false);
    expect(component.trip()).toBeNull();
    expect(component.error()).toBe('Permission denied');
  });
});