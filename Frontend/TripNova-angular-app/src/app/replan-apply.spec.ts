import { describe, expect, it } from 'vitest';
import {
  applyReplanToTrip,
  applyTripTrackingAction,
  getTripCheckpoints,
  ReplanApplication,
  TripRecord,
} from './realtime-database.service';

function delayedTrip(): TripRecord {
  const base: TripRecord = {
    tripId: 'TN-TEST',
    userId: 'jk',
    days: [
      { day: 1, theme: 'Arrival', activities: [{ time: '06:00 AM', place: 'Bus Station', description: 'Board' }] },
      {
        day: 2,
        theme: 'Temples',
        activities: [
          { time: '06:00 AM', place: 'Temple', description: 'Darshan' },
          { time: '10:00 AM', place: 'Canteen', description: 'Breakfast' },
          { time: '01:00 PM', place: 'Waterfall', description: 'Visit' },
        ],
      },
      { day: 3, theme: 'Return', activities: [{ time: '11:00 AM', place: 'Bus Station', description: 'Return' }] },
    ],
  };
  const started = applyTripTrackingAction(base, { type: 'start' }, 'e1', 1)!;
  // Day 1 checkpoint is 9 hours late; the traveller is now heading to "Temple".
  return applyTripTrackingAction(
    started,
    { type: 'delayed', expectedStatus: 'in_progress', expectedCheckpointIndex: 0, delayHrs: 9 },
    'e2',
    2,
  )!;
}

function application(overrides: Partial<ReplanApplication> = {}): ReplanApplication {
  return {
    optionId: '1',
    optionName: 'Compressed Plan',
    expectedCheckpointName: 'Temple',
    expectedDayNumber: 2,
    days: [
      {
        day: 2,
        theme: 'Temples – Compressed',
        activities: [
          { time: '03:15 PM', place: 'Waterfall', description: 'Quick visit', type: 'Sightseeing', estimatedCost: 200 },
          { time: '07:00 PM', place: 'Hotel', description: 'Rest' },
        ],
      },
      { day: 3, theme: 'Return', activities: [{ time: '11:00 AM', place: 'Bus Station', description: 'Return' }] },
    ],
    ...overrides,
  };
}

describe('applyReplanToTrip', () => {
  it('replaces only the itinerary after the current checkpoint and clears the delay', () => {
    const trip = delayedTrip();
    expect(trip.tracking?.delayTriggered).toBe(true);

    const updated = applyReplanToTrip(trip, application(), 99)!;

    expect(updated.tripId).toBe('TN-TEST');
    expect(updated.days[0]).toEqual(trip.days[0]);
    expect(updated.days[1].theme).toBe('Temples – Compressed');
    expect(updated.days[1].activities.map((a) => a.place)).toEqual(['Temple', 'Waterfall', 'Hotel']);
    expect(updated.days).toHaveLength(3);

    const tracking = updated.tracking!;
    expect(tracking.currentCheckpointIndex).toBe(1);
    expect(tracking.driftHrs).toBe(0);
    expect(tracking.delayTriggered).toBe(false);
    expect(tracking.checkpointStates).toHaveLength(getTripCheckpoints(updated).length);
    expect(tracking.checkpointStates![0]).toEqual(trip.tracking!.checkpointStates![0]);
    expect(tracking.checkpointStates![2]).toMatchObject({ checkpointName: 'Waterfall', status: 'not_visited', delayHrs: 0 });
    expect(updated['replan']).toMatchObject({ optionId: '1', absorbedDelayHrs: 9, appliedAt: 99 });
  });

  it('keeps tracking usable after the update', () => {
    const updated = applyReplanToTrip(delayedTrip(), application(), 99)!;
    const next = applyTripTrackingAction(
      updated,
      { type: 'on_time', expectedStatus: 'in_progress', expectedCheckpointIndex: 1 },
      'e3',
      100,
    )!;
    expect(next.tracking?.currentCheckpoint?.checkpointName).toBe('Waterfall');
    expect(next.tracking?.delayTriggered).toBe(false);
  });

  it('does not duplicate the current checkpoint when the option restates it', () => {
    const updated = applyReplanToTrip(
      delayedTrip(),
      application({
        days: [
          {
            day: 2,
            theme: 'Shifted',
            activities: [
              { time: '03:00 PM', place: 'Temple', description: 'Darshan in progress' },
              { time: '07:00 PM', place: 'Canteen', description: 'Late breakfast' },
            ],
          },
        ],
      }),
      99,
    )!;
    expect(updated.days[1].activities.map((a) => a.place)).toEqual(['Temple', 'Canteen']);
    expect(updated.days[1].activities[0].time).toBe('03:00 PM');
    expect(updated.days).toHaveLength(2);
  });

  it('rejects options prepared for a different checkpoint or an untracked trip', () => {
    expect(applyReplanToTrip(delayedTrip(), application({ expectedCheckpointName: 'Bus Station' }), 99)).toBeUndefined();
    expect(applyReplanToTrip(delayedTrip(), application({ days: [] }), 99)).toBeUndefined();
    const untracked = { ...delayedTrip(), tracking: undefined };
    expect(applyReplanToTrip(untracked, application(), 99)).toBeUndefined();
  });
});
