import { Injectable } from '@angular/core';
import { FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { DataSnapshot, equalTo, get, getDatabase, onValue, orderByChild, query, ref, runTransaction, serverTimestamp, set } from 'firebase/database';
import { firebaseConfig } from './firebase.config';
import { UserSessionService } from './user-session.service';

export interface DemoUser {
  userId: string;
  name: string;
  username: string;
}

export interface TripActivity {
  time: string;
  place: string;
  description: string;
}

export interface TripDay {
  day: number;
  theme?: string;
  daySummary?: string;
  activities: TripActivity[];
}

export type TripTrackingStatus = 'not_started' | 'in_progress' | 'completed';
export type CheckpointOutcome = 'started' | 'on_time' | 'delayed' | 'missed' | 'recovered' | 'dropped' | 'skipped';

export interface TripCheckpoint {
  dayNumber: number;
  dayIndex: number;
  dayCheckpointIndex: number;
  checkpointNumber: number;
  overallCheckpointIndex: number;
  checkpointName: string;
  time: string;
  description: string;
}

export interface CheckpointTracking {
  dayNumber: number;
  dayIndex: number;
  dayCheckpointIndex: number;
  checkpointNumber: number;
  overallCheckpointIndex: number;
  checkpointName: string;
  ongoingDate: number | object | null;
  delayHrs: number;
  status: 'visited' | 'not_visited';
  onTime: boolean | null;
  onTrack: boolean | null;
  outcome?: CheckpointOutcome;
}

export interface CurrentCheckpointDetails {
  dayNumber: number;
  dayIndex: number;
  dayCheckpointIndex: number;
  checkpointNumber: number;
  overallCheckpointIndex: number;
  checkpointName: string;
  ongoingDate: number | object | null;
}

export interface TripTrackingEvent {
  id: string;
  type: 'started' | 'on_time' | 'delayed' | 'missed' | 'recovered' | 'dropped' | 'skipped' | 'completed';
  checkpointIndex: number;
  dayNumber?: number;
  dayCheckpointIndex?: number;
  checkpointName?: string;
  occurredAt: number | object;
  delayHrs?: number;
  outcome?: CheckpointOutcome;
}

export interface TripTracking {
  status: TripTrackingStatus;
  currentCheckpointIndex: number;
  driftHrs: number;
  lastEvent: TripTrackingEvent;
  checkpointStates?: CheckpointTracking[];
  currentCheckpoint?: CurrentCheckpointDetails;
  delayThresholdHrs?: number;
  delayTriggered?: boolean;
  unattributedDriftHrs?: number;
  startedAt: number | object;
  completedAt?: number | object;
}

export interface TripRecord {
  [key: string]: unknown;
  tripId?: string;
  userId?: string;
  days: TripDay[];
  tracking?: TripTracking;
}

export type TripTrackingAction =
  | { type: 'start' }
  | { type: 'on_time' | 'missed' | 'dropped' | 'recover' | 'skip'; expectedStatus: TripTrackingStatus; expectedCheckpointIndex: number }
  | { type: 'delayed'; expectedStatus: TripTrackingStatus; expectedCheckpointIndex: number; delayHrs: number };

export type TripLoadResult = { kind: 'found'; trip: TripRecord } | { kind: 'not-found' };
export type TripUpdateResult =
  | { kind: 'committed'; trip: TripRecord }
  | { kind: 'rejected'; trip: TripRecord; refreshRequired: boolean }
  | { kind: 'not-found' };

export const DELAY_TRIGGER_HOURS = 5;

export function getTripCheckpoints(record: TripRecord): TripCheckpoint[] {
  let overallCheckpointIndex = 0;
  return record.days.flatMap((day, dayIndex) => day.activities.map((activity, dayCheckpointIndex) => ({
    dayNumber: day.day,
    dayIndex,
    dayCheckpointIndex,
    checkpointNumber: dayCheckpointIndex + 1,
    overallCheckpointIndex: overallCheckpointIndex++,
    checkpointName: activity.place,
    time: activity.time,
    description: activity.description,
  })));
}

export function withCheckpointTracking(
  record: TripRecord,
  tracking: TripTracking,
  migrationDate: number | object,
): TripTracking {
  const checkpoints = getTripCheckpoints(record);
  const checkpointCount = checkpoints.length;
  const currentCheckpointIndex = Math.max(0, Math.min(tracking.currentCheckpointIndex, checkpointCount - 1));
  const lastEvent = tracking.lastEvent;
  const existingStates = tracking.checkpointStates;
  const checkpointStates = existingStates?.length === checkpointCount
    ? existingStates
    : checkpoints.map((checkpoint) => {
      const eventApplies = checkpoint.overallCheckpointIndex === lastEvent.checkpointIndex;
      const skippedOrMissed = eventApplies && ['missed', 'dropped', 'skipped'].includes(lastEvent.type);
      const lifecycleStatus = (tracking as { status: string }).status;
      const visited = checkpoint.overallCheckpointIndex < currentCheckpointIndex && !skippedOrMissed
        || lifecycleStatus === 'completed' && checkpoint.overallCheckpointIndex === currentCheckpointIndex && !skippedOrMissed;
      const delayHrs = eventApplies ? lastEvent.delayHrs ?? 0 : 0;
      const eventOutcome = lastEvent.type === 'completed' ? lastEvent.outcome : lastEvent.type;
      const knownOutcome = eventApplies && ['on_time', 'delayed', 'missed', 'recovered', 'dropped', 'skipped'].includes(eventOutcome ?? '')
        ? eventOutcome as CheckpointOutcome
        : undefined;
      const checkpointStatus: CheckpointTracking['status'] = visited ? 'visited' : 'not_visited';

      return {
        dayNumber: checkpoint.dayNumber,
        dayIndex: checkpoint.dayIndex,
        dayCheckpointIndex: checkpoint.dayCheckpointIndex,
        checkpointNumber: checkpoint.checkpointNumber,
        overallCheckpointIndex: checkpoint.overallCheckpointIndex,
        checkpointName: checkpoint.checkpointName,
        ongoingDate: eventApplies ? lastEvent.occurredAt : null,
        delayHrs,
        status: checkpointStatus,
        onTime: eventApplies && lastEvent.type === 'on_time' ? true : knownOutcome && knownOutcome !== 'missed' && knownOutcome !== 'dropped' && knownOutcome !== 'skipped' ? false : null,
        onTrack: eventApplies && knownOutcome
          ? !['missed', 'dropped', 'skipped'].includes(knownOutcome) && tracking.driftHrs < DELAY_TRIGGER_HOURS
          : null,
        ...(knownOutcome ? { outcome: knownOutcome } : {}),
      };
    });
  const attributedDelayHrs = checkpointStates.reduce((total, checkpoint) => total + checkpoint.delayHrs, 0);
  const currentCheckpoint = checkpoints[currentCheckpointIndex];

  return {
    ...tracking,
    status: ['missed', 'dropped'].includes((tracking as { status: string }).status) ? 'in_progress' : tracking.status,
    currentCheckpointIndex,
    checkpointStates,
    currentCheckpoint: {
      dayNumber: currentCheckpoint.dayNumber,
      dayIndex: currentCheckpoint.dayIndex,
      dayCheckpointIndex: currentCheckpoint.dayCheckpointIndex,
      checkpointNumber: currentCheckpoint.checkpointNumber,
      overallCheckpointIndex: currentCheckpoint.overallCheckpointIndex,
      checkpointName: currentCheckpoint.checkpointName,
      ongoingDate: tracking.currentCheckpoint?.ongoingDate ?? migrationDate,
    },
    delayThresholdHrs: DELAY_TRIGGER_HOURS,
    delayTriggered: tracking.driftHrs >= DELAY_TRIGGER_HOURS,
    unattributedDriftHrs: tracking.unattributedDriftHrs ?? Math.max(0, tracking.driftHrs - attributedDelayHrs),
  };
}

export function applyTripTrackingAction(
  record: TripRecord | null,
  action: TripTrackingAction,
  eventId: string,
  occurredAt: number | object,
): TripRecord | undefined {
  if (!record || !Array.isArray(record.days)) {
    return undefined;
  }

  const checkpoints = getTripCheckpoints(record);
  const checkpointCount = checkpoints.length;
  if (checkpointCount === 0) {
    return undefined;
  }

  if (action.type === 'start') {
    if (record.tracking != null) {
      return undefined;
    }

    const tracking = withCheckpointTracking(record, {
      status: 'in_progress',
      currentCheckpointIndex: 0,
      driftHrs: 0,
      startedAt: occurredAt,
      lastEvent: {
        id: eventId,
        type: 'started',
        checkpointIndex: 0,
        dayNumber: checkpoints[0].dayNumber,
        dayCheckpointIndex: checkpoints[0].dayCheckpointIndex,
        checkpointName: checkpoints[0].checkpointName,
        occurredAt,
      },
    }, occurredAt);
    tracking.currentCheckpoint = { ...tracking.currentCheckpoint!, ongoingDate: occurredAt };
    return { ...record, tracking };
  }

  const tracking = record.tracking && withCheckpointTracking(record, record.tracking, occurredAt);
  if (
    !tracking || tracking.lastEvent?.id === eventId || tracking.status !== action.expectedStatus ||
    tracking.currentCheckpointIndex !== action.expectedCheckpointIndex ||
    tracking.currentCheckpointIndex < 0 || tracking.currentCheckpointIndex >= checkpointCount
  ) {
    return undefined;
  }

  if (tracking.status === 'completed') {
    return undefined;
  }

  if (action.type === 'delayed' && (!Number.isFinite(action.delayHrs) || action.delayHrs < 0)) {
    return undefined;
  }

  const currentIndex = tracking.currentCheckpointIndex;
  const currentCheckpoint = checkpoints[currentIndex];
  const previousOutcome = tracking.lastEvent.type;
  const checkpointStates = [...(tracking.checkpointStates ?? [])];
  const currentState = checkpointStates[currentIndex];

  if (action.type === 'missed' || action.type === 'dropped') {
    if (tracking.status !== 'in_progress' || previousOutcome === 'missed' || previousOutcome === 'dropped') {
      return undefined;
    }
    checkpointStates[currentIndex] = {
      ...currentState,
      status: 'not_visited',
      onTime: false,
      onTrack: false,
      outcome: action.type,
      ongoingDate: occurredAt,
    };
    const nextTracking: TripTracking = {
      ...tracking,
      status: 'in_progress',
      checkpointStates,
      currentCheckpoint: { ...tracking.currentCheckpoint!, ongoingDate: occurredAt },
      delayTriggered: tracking.driftHrs >= DELAY_TRIGGER_HOURS,
      lastEvent: {
        id: eventId,
        type: action.type,
        checkpointIndex: currentIndex,
        dayNumber: currentCheckpoint.dayNumber,
        dayCheckpointIndex: currentCheckpoint.dayCheckpointIndex,
        checkpointName: currentCheckpoint.checkpointName,
        occurredAt,
      },
    };
    return {
      ...record,
      tracking: nextTracking,
    };
  }

  if (action.type === 'recover' && (tracking.status !== 'in_progress' || previousOutcome !== 'missed')) {
    return undefined;
  }
  if (action.type === 'skip' && (tracking.status !== 'in_progress' || previousOutcome !== 'dropped')) {
    return undefined;
  }
  if ((action.type === 'on_time' || action.type === 'delayed') && tracking.status !== 'in_progress') {
    return undefined;
  }
  if ((action.type === 'on_time' || action.type === 'delayed') && (previousOutcome === 'missed' || previousOutcome === 'dropped')) {
    return undefined;
  }

  const isFinalCheckpoint = currentIndex === checkpointCount - 1;
  const delayHrs = action.type === 'delayed' ? action.delayHrs : action.type === 'recover' ? 2 : 0;
  const eventType = action.type === 'recover' ? 'recovered' : action.type === 'skip' ? 'skipped' : action.type;
  const outcome = action.type === 'recover' ? 'recovered' : action.type === 'skip' ? 'skipped' : action.type;
  const nextDriftHrs = tracking.driftHrs + delayHrs;
  const nextIndex = isFinalCheckpoint ? currentIndex : currentIndex + 1;
  const visited = action.type !== 'skip';
  checkpointStates[currentIndex] = {
    ...currentState,
    status: visited ? 'visited' : 'not_visited',
    delayHrs: currentState.delayHrs + delayHrs,
    onTime: action.type === 'on_time',
    onTrack: action.type !== 'skip' && nextDriftHrs < DELAY_TRIGGER_HOURS,
    outcome,
    ongoingDate: occurredAt,
  };
  const nextCheckpoint = checkpoints[nextIndex];
  const lastEvent: TripTrackingEvent = {
    id: eventId,
    type: isFinalCheckpoint ? 'completed' : eventType,
    checkpointIndex: currentIndex,
    dayNumber: currentCheckpoint.dayNumber,
    dayCheckpointIndex: currentCheckpoint.dayCheckpointIndex,
    checkpointName: currentCheckpoint.checkpointName,
    occurredAt,
    ...(delayHrs > 0 ? { delayHrs } : {}),
    ...(isFinalCheckpoint ? { outcome } : {}),
  };

  return {
    ...record,
    tracking: {
      ...tracking,
      status: isFinalCheckpoint ? 'completed' : 'in_progress',
      currentCheckpointIndex: nextIndex,
      driftHrs: nextDriftHrs,
      delayTriggered: nextDriftHrs >= DELAY_TRIGGER_HOURS,
      checkpointStates,
      currentCheckpoint: {
        dayNumber: nextCheckpoint.dayNumber,
        dayIndex: nextCheckpoint.dayIndex,
        dayCheckpointIndex: nextCheckpoint.dayCheckpointIndex,
        checkpointNumber: nextCheckpoint.checkpointNumber,
        overallCheckpointIndex: nextCheckpoint.overallCheckpointIndex,
        checkpointName: nextCheckpoint.checkpointName,
        ongoingDate: occurredAt,
      },
      unattributedDriftHrs: tracking.unattributedDriftHrs ?? 0,
      lastEvent,
      ...(isFinalCheckpoint ? { completedAt: occurredAt } : {}),
    },
  };
}

/** A re-planned day as returned by the replan API; extra detail fields are kept as-is. */
export interface ReplanDayInput {
  [key: string]: unknown;
  day: number;
  activities?: unknown[];
}

export interface ReplanApplication {
  optionId: string;
  optionName: string;
  /** Checkpoint the options were generated for; the update is rejected if the trip has moved on. */
  expectedCheckpointName: string | null;
  expectedDayNumber: number | null;
  days: ReplanDayInput[];
}

export type ReplanApplyResult =
  | { kind: 'applied'; trip: TripRecord }
  | { kind: 'stale' }
  | { kind: 'not-found' };

function toTripActivity(value: unknown): Record<string, unknown> {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const asText = (field: unknown): string => (field === null || field === undefined ? '' : String(field));
  return {
    ...source,
    time: asText(source['time']),
    place: asText(source['place']),
    description: asText(source['description']),
    ...(source['type'] === null || source['type'] === undefined ? {} : { type: asText(source['type']) }),
  };
}

/**
 * Replaces the not-yet-reached part of a tracked trip with a re-itinerary option.
 * Everything up to and including the current checkpoint is preserved, so the
 * tracking cursor and visited history stay valid. The accumulated delay is
 * cleared because the new schedule already starts from the traveller's actual time.
 * Returns `undefined` when the option no longer matches the trip.
 */
export function applyReplanToTrip(
  record: TripRecord | null,
  application: ReplanApplication,
  appliedAt: number | object,
): TripRecord | undefined {
  const tracking = record?.tracking;
  if (!record || !Array.isArray(record.days) || !tracking || tracking.status !== 'in_progress') {
    return undefined;
  }

  const checkpoints = getTripCheckpoints(record);
  const currentIndex = tracking.currentCheckpointIndex;
  const current = checkpoints[currentIndex];
  if (!current) {
    return undefined;
  }
  if (
    (application.expectedCheckpointName !== null && application.expectedCheckpointName !== current.checkpointName) ||
    (application.expectedDayNumber !== null && application.expectedDayNumber !== current.dayNumber)
  ) {
    return undefined;
  }

  const newDays = application.days
    .filter((day) => Number.isInteger(day.day) && day.day >= current.dayNumber && Array.isArray(day.activities))
    // The home page only accepts a string theme, so drop anything else the model returned.
    .map((day) => (typeof day['theme'] === 'string' ? day : { ...day, theme: null }))
    .sort((a, b) => a.day - b.day);
  if (newDays.length === 0) {
    return undefined;
  }

  const currentDay = record.days[current.dayIndex];
  const keptActivities: unknown[] = currentDay.activities.slice(0, current.dayCheckpointIndex + 1);
  const replacementForCurrentDay = newDays.find((day) => day.day === current.dayNumber);
  let appended = (replacementForCurrentDay?.activities ?? []).map(toTripActivity);

  // Options may restate the current checkpoint as their first stop: keep the
  // tracked one (with the new time) rather than adding a duplicate.
  const first = appended[0];
  if (first && String(first['place']).trim().toLowerCase() === current.checkpointName.trim().toLowerCase()) {
    keptActivities[keptActivities.length - 1] = {
      ...currentDay.activities[current.dayCheckpointIndex],
      time: first['time'],
    };
    appended = appended.slice(1);
  }

  const days = [
    ...record.days.slice(0, current.dayIndex),
    {
      ...currentDay,
      ...(replacementForCurrentDay ?? {}),
      day: currentDay.day,
      activities: [...keptActivities, ...appended],
    },
    ...newDays
      .filter((day) => day.day > current.dayNumber)
      .map((day) => ({ ...day, activities: (day.activities ?? []).map(toTripActivity) })),
  ] as TripDay[];

  const nextRecord: TripRecord = { ...record, days };
  const nextCheckpoints = getTripCheckpoints(nextRecord);
  const checkpointStates: CheckpointTracking[] = nextCheckpoints.map((checkpoint, index) => {
    const existing = index <= currentIndex ? tracking.checkpointStates?.[index] : undefined;
    return existing ?? {
      dayNumber: checkpoint.dayNumber,
      dayIndex: checkpoint.dayIndex,
      dayCheckpointIndex: checkpoint.dayCheckpointIndex,
      checkpointNumber: checkpoint.checkpointNumber,
      overallCheckpointIndex: checkpoint.overallCheckpointIndex,
      checkpointName: checkpoint.checkpointName,
      ongoingDate: null,
      delayHrs: 0,
      status: 'not_visited',
      onTime: null,
      onTrack: null,
    };
  });

  return {
    ...nextRecord,
    tracking: {
      ...tracking,
      checkpointStates,
      driftHrs: 0,
      unattributedDriftHrs: 0,
      delayTriggered: false,
    },
    replan: {
      optionId: application.optionId,
      optionName: application.optionName,
      absorbedDelayHrs: tracking.driftHrs,
      appliedAt,
    },
  };
}

@Injectable({ providedIn: 'root' })
export class RealtimeDatabaseService {
  constructor(private readonly userSession?: UserSessionService) {}

  /**
   * Observe only trips whose stored owner matches the signed-in user.
   */
  subscribeToTravelerHomeTrip(
    userId: string,
    onSnapshot: (snapshot: DataSnapshot) => void,
    onError: (error: Error) => void,
  ): () => void {
    let active = true;
    let stopListening = (): void => {};
    const stopOnce = (): void => {
      if (!active) {
        return;
      }
      active = false;
      stopListening();
    };

    const userTripsQuery = query(
      ref(this.getDatabase(), 'userTrips'),
      orderByChild('userId'),
      equalTo(userId),
    );
    stopListening = onValue(
      userTripsQuery,
      (snapshot) => {
        if (active) {
          onSnapshot(snapshot);
        }
      },
      (error) => {
        if (!active) {
          return;
        }
        stopOnce();
        onError(error);
      },
    );

    return stopOnce;
  }

  async loadTrip(tripId: string): Promise<TripLoadResult> {
    const normalizedId = this.normalizeTripId(tripId);

    const tripRef = ref(this.getDatabase(), `userTrips/${normalizedId}`);
    const snapshot = await this.readOnce(tripRef);
    if (!snapshot.exists()) {
      return { kind: 'not-found' };
    }

    let trip = snapshot.val() as TripRecord;
    if (
      !trip || typeof trip !== 'object' || !Array.isArray(trip.days) ||
      !trip.days.every((day) => day && typeof day === 'object' && Array.isArray(day.activities))
    ) {
      throw new Error('This trip does not contain a usable itinerary.');
    }
    const activities = trip.days.flatMap((day) => day.activities);
    if (activities.length === 0 || !activities.every((activity) => this.isTripActivity(activity))) {
      throw new Error('This trip does not contain a usable itinerary.');
    }
    const checkpointCount = activities.length;
    if (trip.tracking != null && !this.hasValidTracking(trip.tracking, checkpointCount)) {
      throw new Error('This trip has invalid tracking data.');
    }
    if (trip.tracking) {
      trip = await this.ensureCheckpointTracking(normalizedId, trip);
    }

    return { kind: 'found', trip };
  }

  async updateTripTracking(tripId: string, action: TripTrackingAction): Promise<TripUpdateResult> {
    const normalizedId = this.normalizeTripId(tripId);

    const eventId = this.createEventId();
    const occurredAt = serverTimestamp();
    const tripRef = ref(this.getDatabase(), `userTrips/${normalizedId}`);
    const presenceSnapshot = await this.readOnce(tripRef);
    if (!presenceSnapshot.exists()) {
      return { kind: 'not-found' };
    }
    const { snapshot, unsubscribe } = await this.listenForTrip(tripRef);
    if (!snapshot.exists()) {
      unsubscribe();
      return { kind: 'not-found' };
    }

    try {
      const result = await runTransaction(tripRef, (currentValue) =>
        applyTripTrackingAction(currentValue as TripRecord | null, action, eventId, occurredAt),
      { applyLocally: false });
      const trip = result.snapshot.val() as TripRecord | null;

      if (result.committed && trip) {
        return { kind: 'committed', trip };
      }
      return {
        kind: 'rejected',
        trip: trip ?? snapshot.val() as TripRecord,
        refreshRequired: true,
      };
    } finally {
      unsubscribe();
    }
  }

  /**
   * Re-itinerary flow: rewrites the remaining itinerary of the existing trip
   * `userTrips/{tripId}` in place (same trip ID) with the chosen option.
   */
  async applyReplan(tripId: string, application: ReplanApplication): Promise<ReplanApplyResult> {
    const normalizedId = this.normalizeTripId(tripId);
    // Realtime Database rejects `undefined`, so strip it by round-tripping through JSON.
    const cleanApplication = JSON.parse(JSON.stringify(application)) as ReplanApplication;
    const appliedAt = serverTimestamp();
    const tripRef = ref(this.getDatabase(), `userTrips/${normalizedId}`);
    if (!(await this.readOnce(tripRef)).exists()) {
      return { kind: 'not-found' };
    }
    const { unsubscribe } = await this.listenForTrip(tripRef);

    try {
      const result = await runTransaction(tripRef, (currentValue) =>
        applyReplanToTrip(currentValue as TripRecord | null, cleanApplication, appliedAt),
      { applyLocally: false });
      const trip = result.snapshot.val() as TripRecord | null;
      return result.committed && trip ? { kind: 'applied', trip } : { kind: 'stale' };
    } finally {
      unsubscribe();
    }
  }

  /**
   * Saves a booked trip under `userTrips/{tripId}` and returns the generated trip ID.
   * The record keeps the `days` itinerary so the trip can later be loaded for tracking.
   */
  async createTrip(record: Record<string, unknown>): Promise<string> {
    const user = this.userSession?.currentUser();
    if (!user) {
      throw new Error('Sign in before saving a trip.');
    }

    const tripId = this.createTripId();
    // Realtime Database rejects `undefined`, so strip it by round-tripping through JSON.
    const payload = JSON.parse(JSON.stringify(record)) as Record<string, unknown>;
    await set(ref(this.getDatabase(), `userTrips/${tripId}`), {
      ...payload,
      tripId,
      userId: user.userId,
      createdAt: serverTimestamp(),
    });
    return tripId;
  }

  async registerUser(name: string, username: string, password: string): Promise<DemoUser> {
    const database = this.getDatabase();
    const userRef = ref(database, `demo-users/${this.getUserKey(username)}`);

    if ((await get(userRef)).exists()) {
      throw new Error('That username is already registered.');
    }

    const normalizedUsername = username.trim();
    const user: DemoUser = {
      userId: this.getUserKey(normalizedUsername),
      name: name.trim(),
      username: normalizedUsername,
    };
    await set(userRef, {
      ...user,
      passwordHash: await this.hashPassword(password),
    });
    return user;
  }

  async loginUser(username: string, password: string): Promise<DemoUser> {
    const snapshot = await get(ref(this.getDatabase(), `demo-users/${this.getUserKey(username)}`));

    if (!snapshot.exists() || snapshot.val().passwordHash !== await this.hashPassword(password)) {
      throw new Error('Username or password is incorrect.');
    }

    const user = snapshot.val() as Partial<DemoUser>;
    return {
      userId: user.userId ?? this.getUserKey(username),
      name: user.name ?? '',
      username: user.username ?? username.trim(),
    };
  }

  private getDatabase() {
    if (!firebaseConfig.databaseURL) {
      throw new Error('Firebase Realtime Database URL is missing.');
    }

    return getDatabase(this.getFirebaseApp());
  }

  private async ensureCheckpointTracking(tripId: string, trip: TripRecord): Promise<TripRecord> {
    const tracking = trip.tracking;
    if (!tracking) {
      return trip;
    }
    const checkpointCount = getTripCheckpoints(trip).length;
    const storedStatus = (tracking as { status: string }).status;
    const hasCurrentDetails = tracking.currentCheckpoint
      && typeof tracking.delayTriggered === 'boolean'
      && storedStatus !== 'missed'
      && storedStatus !== 'dropped'
      && tracking.checkpointStates?.length === checkpointCount;
    if (hasCurrentDetails) {
      return trip;
    }

    const tripRef = ref(this.getDatabase(), `userTrips/${tripId}`);
    const { snapshot, unsubscribe } = await this.listenForTrip(tripRef);
    if (!snapshot.exists()) {
      unsubscribe();
      return trip;
    }
    const migrationDate = serverTimestamp();
    try {
      const result = await runTransaction(tripRef, (currentValue) => {
        const currentTrip = currentValue as TripRecord | null;
        const currentTracking = currentTrip?.tracking;
        if (!currentTrip || !currentTracking || currentTracking.lastEvent?.id !== tracking.lastEvent?.id) {
          return undefined;
        }
        return {
          ...currentTrip,
          tracking: withCheckpointTracking(currentTrip, currentTracking, migrationDate),
        };
      }, { applyLocally: false });
      return result.snapshot.val() as TripRecord ?? trip;
    } finally {
      unsubscribe();
    }
  }

  private readOnce(databaseRef: ReturnType<typeof ref>): Promise<DataSnapshot> {
    return new Promise((resolve, reject) => {
      let unsubscribe: (() => void) | undefined;
      unsubscribe = onValue(databaseRef, (snapshot) => {
        unsubscribe?.();
        resolve(snapshot);
      }, (error) => {
        unsubscribe?.();
        reject(error);
      }, { onlyOnce: true });
    });
  }

  private listenForTrip(databaseRef: ReturnType<typeof ref>): Promise<{ snapshot: DataSnapshot; unsubscribe: () => void }> {
    return new Promise((resolve, reject) => {
      let snapshot: DataSnapshot | undefined;
      let unsubscribe: () => void = () => {};
      let listenerReady = false;
      let settled = false;
      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          unsubscribe();
          reject(new Error('Could not synchronize the trip before saving. Reload and try again.'));
        }
      }, 10000);

      const finish = (): void => {
        if (listenerReady && snapshot?.exists() && !settled) {
          settled = true;
          clearTimeout(timeout);
          resolve({ snapshot, unsubscribe });
        }
      };

      const stopListening = onValue(databaseRef, (value) => {
        snapshot = value;
        finish();
      }, (error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          unsubscribe();
          reject(error);
        }
      });
      unsubscribe = stopListening;
      listenerReady = true;
      finish();
    });
  }

  private normalizeTripId(tripId: string): string {
    const normalizedId = tripId.trim();
    if (!normalizedId) {
      throw new Error('Enter a trip ID.');
    }
    const hasReservedCharacter = ['.', '#', '$', '[', ']', '/'].some((character) => normalizedId.includes(character));
    const hasControlCharacter = Array.from(normalizedId).some((character) => {
      const code = character.charCodeAt(0);
      return code <= 31 || code === 127;
    });
    if (hasReservedCharacter || hasControlCharacter) {
      throw new Error('Trip ID contains characters that are not valid in Firebase keys.');
    }
    return normalizedId;
  }

  private isTripActivity(value: unknown): value is TripActivity {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const activity = value as TripActivity;
    return typeof activity.time === 'string'
      && typeof activity.place === 'string'
      && typeof activity.description === 'string';
  }

  private hasValidTracking(value: unknown, checkpointCount: number): value is TripTracking {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const tracking = value as TripTracking;
    const status = (value as { status?: unknown }).status;
    return ['not_started', 'in_progress', 'missed', 'dropped', 'completed'].includes(String(status))
      && Number.isInteger(tracking.currentCheckpointIndex)
      && tracking.currentCheckpointIndex >= 0
      && tracking.currentCheckpointIndex < checkpointCount
      && Number.isFinite(tracking.driftHrs)
      && tracking.driftHrs >= 0
      && Boolean(tracking.lastEvent && typeof tracking.lastEvent.id === 'string');
  }

  private async hashPassword(password: string): Promise<string> {
    if (!globalThis.crypto?.subtle) {
      throw new Error('Secure password hashing is not available in this browser.');
    }

    const bytes = new TextEncoder().encode(password);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  private getUserKey(username: string): string {
    return encodeURIComponent(username.trim().toLowerCase());
  }

  /** Short, readable ID (e.g. `TN-7K2QX9`) that is safe to use as a Firebase key. */
  private createTripId(): string {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const bytes = new Uint8Array(6);
    if (globalThis.crypto?.getRandomValues) {
      globalThis.crypto.getRandomValues(bytes);
    } else {
      bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
    }
    return `TN-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')}`;
  }

  private createEventId(): string {
    return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  private getFirebaseApp(): FirebaseApp {
    return getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  }
}
