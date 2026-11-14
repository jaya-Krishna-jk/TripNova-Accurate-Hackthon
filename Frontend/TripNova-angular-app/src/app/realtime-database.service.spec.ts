import { beforeEach, describe, expect, it, vi } from 'vitest';

const firebaseMocks = vi.hoisted(() => ({
  getDatabase: vi.fn(() => ({})),
  onValue: vi.fn(),
  ref: vi.fn((_database: unknown, path: string) => path),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(() => ({ '.sv': 'timestamp' })),
  set: vi.fn(),
}));

vi.mock('firebase/app', () => ({
  getApp: vi.fn(() => ({})),
  getApps: vi.fn(() => [{}]),
  initializeApp: vi.fn(() => ({})),
}));

vi.mock('firebase/database', () => firebaseMocks);

import {
  applyTripTrackingAction,
  RealtimeDatabaseService,
  TripRecord,
} from './realtime-database.service';

const tripRecord: TripRecord = {
  tripId: '111',
  userId: 'jk',
  customField: 'preserved',
  days: [
    { day: 1, activities: [
      { time: '06:00 AM', place: 'Hyderabad Bus Station', description: 'Bus departure' },
      { time: '04:00 PM', place: 'Thirupathi Bus Station', description: 'Arrival' },
    ] },
  ],
};

describe('RealtimeDatabaseService trip tracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the requested trip path and returns the Firebase record', async () => {
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => true, val: () => tripRecord }));
      return vi.fn();
    });
    const service = new RealtimeDatabaseService();

    const result = await service.loadTrip('111');

    expect(firebaseMocks.ref).toHaveBeenCalledWith({}, 'userTrips/111');
    expect(result).toEqual({ kind: 'found', trip: tripRecord });
  });

  it('returns not-found for a missing Firebase record without using fallback data', async () => {
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => false, val: () => null }));
      return vi.fn();
    });
    const service = new RealtimeDatabaseService();

    await expect(service.loadTrip('missing')).resolves.toEqual({ kind: 'not-found' });
  });

  it('rejects IDs that cannot identify a single Firebase child', async () => {
    const service = new RealtimeDatabaseService();

    await expect(service.loadTrip('111/child')).rejects.toThrow('not valid in Firebase keys');
    await expect(service.loadTrip('111\u0001')).rejects.toThrow('not valid in Firebase keys');
    expect(firebaseMocks.onValue).not.toHaveBeenCalled();
  });

  it('rejects malformed activity entries before the component can render them', async () => {
    const malformedTrip = { ...tripRecord, days: [{ day: 1, activities: [null] }] };
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => true, val: () => malformedTrip }));
      return vi.fn();
    });
    const service = new RealtimeDatabaseService();

    await expect(service.loadTrip('111')).rejects.toThrow('usable itinerary');
  });

  it('rejects malformed days even when another day contains valid activities', async () => {
    const malformedTrip = {
      ...tripRecord,
      days: [tripRecord.days[0], null],
    };
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => true, val: () => malformedTrip }));
      return vi.fn();
    });
    const service = new RealtimeDatabaseService();

    await expect(service.loadTrip('111')).rejects.toThrow('usable itinerary');
  });

  it('rejects persisted tracking with an invalid checkpoint index', async () => {
    const malformedTrip = {
      ...tripRecord,
      tracking: {
        status: 'in_progress', currentCheckpointIndex: -1, driftHrs: 0, startedAt: 123,
        lastEvent: { id: 'start-1', type: 'started', checkpointIndex: 0, occurredAt: 123 },
      },
    };
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => true, val: () => malformedTrip }));
      return vi.fn();
    });
    const service = new RealtimeDatabaseService();

    await expect(service.loadTrip('111')).rejects.toThrow('invalid tracking data');
  });

  it('initializes tracking once and preserves every other record field', () => {
    const started = applyTripTrackingAction(tripRecord, { type: 'start' }, 'event-1', 123);

    expect(started?.['customField']).toBe('preserved');
    expect(started?.days).toEqual(tripRecord.days);
    expect(started?.tracking).toMatchObject({
      status: 'in_progress',
      currentCheckpointIndex: 0,
      driftHrs: 0,
      startedAt: 123,
      lastEvent: { id: 'event-1', type: 'started', checkpointIndex: 0, occurredAt: 123 },
    });
    expect(applyTripTrackingAction(started!, { type: 'start' }, 'event-2', 124)).toBeUndefined();
  });

  it('adds fractional delay hours and advances one checkpoint', () => {
    const started = applyTripTrackingAction(tripRecord, { type: 'start' }, 'event-1', 123)!;
    const delayed = applyTripTrackingAction(started, {
      type: 'delayed',
      expectedStatus: 'in_progress',
      expectedCheckpointIndex: 0,
      delayHrs: 0.5,
    }, 'event-2', 124);

    expect(delayed?.tracking).toMatchObject({ status: 'in_progress', currentCheckpointIndex: 1, driftHrs: 0.5 });
  });

  it('adds two hours on missed recovery and no hours on dropped skip', () => {
    const started = applyTripTrackingAction(tripRecord, { type: 'start' }, 'event-1', 123)!;
    const missed = applyTripTrackingAction(started, {
      type: 'missed', expectedStatus: 'in_progress', expectedCheckpointIndex: 0,
    }, 'event-2', 124)!;
    const recovered = applyTripTrackingAction(missed, {
      type: 'recover', expectedStatus: 'missed', expectedCheckpointIndex: 0,
    }, 'event-3', 125)!;
    const dropped = applyTripTrackingAction(recovered, {
      type: 'dropped', expectedStatus: 'in_progress', expectedCheckpointIndex: 1,
    }, 'event-4', 126)!;
    const skipped = applyTripTrackingAction(dropped, {
      type: 'skip', expectedStatus: 'dropped', expectedCheckpointIndex: 1,
    }, 'event-5', 127);

    expect(recovered.tracking).toMatchObject({ currentCheckpointIndex: 1, driftHrs: 2 });
    expect(skipped?.tracking).toMatchObject({ status: 'completed', currentCheckpointIndex: 1, driftHrs: 2 });
    expect(skipped?.tracking?.completedAt).toBe(127);
    expect(skipped?.tracking?.lastEvent).toMatchObject({ type: 'completed', outcome: 'skipped' });
  });

  it('rejects stale checkpoint commands and invalid delay values', () => {
    const started = applyTripTrackingAction(tripRecord, { type: 'start' }, 'event-1', 123)!;

    expect(applyTripTrackingAction(started, {
      type: 'on_time', expectedStatus: 'in_progress', expectedCheckpointIndex: 1,
    }, 'event-2', 124)).toBeUndefined();
    expect(applyTripTrackingAction(started, {
      type: 'delayed', expectedStatus: 'in_progress', expectedCheckpointIndex: 0, delayHrs: -1,
    }, 'event-3', 125)).toBeUndefined();
    expect(applyTripTrackingAction(started, {
      type: 'on_time', expectedStatus: 'in_progress', expectedCheckpointIndex: 0,
    }, 'event-1', 126)).toBeUndefined();
  });

  it('persists a start through a root transaction and returns committed data', async () => {
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => true, val: () => tripRecord }));
      return vi.fn();
    });
    firebaseMocks.runTransaction.mockImplementation(async (tripRef, updater) => {
      const next = updater(tripRecord);
      return { committed: true, snapshot: { val: () => next }, ref: tripRef };
    });
    const service = new RealtimeDatabaseService();

    const result = await service.updateTripTracking('111', { type: 'start' });

    expect(firebaseMocks.ref).toHaveBeenCalledWith({}, 'userTrips/111');
    expect(firebaseMocks.runTransaction).toHaveBeenCalledWith('userTrips/111', expect.any(Function), { applyLocally: false });
    expect(result.kind).toBe('committed');
    if (result.kind === 'committed') {
      expect(result.trip.tracking?.status).toBe('in_progress');
      expect(result.trip['customField']).toBe('preserved');
    }
  });

  it('aborts an event when the transaction retries against an advanced checkpoint', async () => {
    const started = applyTripTrackingAction(tripRecord, { type: 'start' }, 'start-id', 123)!;
    const concurrentlyAdvanced = applyTripTrackingAction(started, {
      type: 'on_time', expectedStatus: 'in_progress', expectedCheckpointIndex: 0,
    }, 'other-event', 124)!;
    firebaseMocks.onValue.mockImplementation((_ref, callback) => {
      queueMicrotask(() => callback({ exists: () => true, val: () => started }));
      return vi.fn();
    });
    firebaseMocks.runTransaction.mockImplementation(async (_tripRef, updater) => {
      expect(updater(started)).toBeDefined();
      expect(updater(concurrentlyAdvanced)).toBeUndefined();
      return { committed: false, snapshot: { val: () => concurrentlyAdvanced } };
    });
    const service = new RealtimeDatabaseService();

    const result = await service.updateTripTracking('111', {
      type: 'on_time', expectedStatus: 'in_progress', expectedCheckpointIndex: 0,
    });

    expect(result).toEqual({ kind: 'rejected', trip: concurrentlyAdvanced });
  });
});