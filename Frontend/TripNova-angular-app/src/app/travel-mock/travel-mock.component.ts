import { CommonModule } from '@angular/common';
import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CheckpointTracking,
  RealtimeDatabaseService,
  TripCheckpoint,
  TripRecord,
  TripTrackingAction,
  TripTrackingStatus,
} from '../realtime-database.service';

@Component({
  selector: 'app-travel-mock',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './travel-mock.component.html',
  styleUrl: './travel-mock.component.css',
})
export class TravelMockComponent {
  tripId = '';
  delayHours = 0.5;
  trip = signal<TripRecord | null>(null);
  loading = signal(false);
  actionPending = signal(false);
  notFound = signal(false);
  error = signal('');
  refreshRequired = signal(false);
  decision = signal('Enter the trip ID to load its Firebase itinerary.');

  private loadedTripId = '';
  private loadSequence = 0;

  constructor(private readonly database: RealtimeDatabaseService) {}

  async loadTrip(): Promise<void> {
    if (this.actionPending()) {
      return;
    }

    const requestedId = this.tripId.trim();
    const sequence = ++this.loadSequence;
    this.trip.set(null);
    this.loadedTripId = '';
    this.notFound.set(false);
    this.error.set('');
    this.refreshRequired.set(false);

    if (!requestedId) {
      this.loading.set(false);
      this.decision.set('Enter a trip ID to continue.');
      return;
    }

    this.loading.set(true);
    this.decision.set('Loading trip from Firebase...');
    try {
      const result = await this.database.loadTrip(requestedId);
      if (sequence !== this.loadSequence) {
        return;
      }
      if (result.kind === 'not-found') {
        this.notFound.set(true);
        this.decision.set(`No trip found with ID ${requestedId}.`);
        return;
      }

      this.trip.set(result.trip);
      this.loadedTripId = requestedId;
      this.decision.set(`Trip ${requestedId} loaded from Firebase.`);
    } catch (error) {
      if (sequence === this.loadSequence) {
        this.error.set(this.getErrorMessage(error, 'Could not load this trip from Firebase.'));
        this.decision.set('Trip load failed. Check the connection and try again.');
      }
    } finally {
      if (sequence === this.loadSequence) {
        this.loading.set(false);
      }
    }
  }

  async startTrip(): Promise<void> {
    if (this.trip()?.tracking || this.refreshRequired()) {
      return;
    }
    await this.submitAction({ type: 'start' });
  }

  async recordDecision(choice: 'caught' | 'delayed' | 'missed' | 'dropped'): Promise<void> {
    const tracking = this.trip()?.tracking;
    if (
      tracking?.status !== 'in_progress' || this.refreshRequired() ||
      tracking.lastEvent.type === 'missed' || tracking.lastEvent.type === 'dropped'
    ) {
      return;
    }

    const expected = {
      expectedStatus: tracking.status,
      expectedCheckpointIndex: tracking.currentCheckpointIndex,
    } as const;
    if (choice === 'caught') {
      await this.submitAction({ type: 'on_time', ...expected });
    } else if (choice === 'delayed') {
      const delayHrs = Number(this.delayHours);
      if (!Number.isFinite(delayHrs) || delayHrs < 0) {
        this.error.set('Enter a valid delay in hours (zero or more).');
        return;
      }
      await this.submitAction({ type: 'delayed', delayHrs, ...expected });
    } else {
      await this.submitAction({ type: choice, ...expected });
    }
  }

  async recoverMissedCheckpoint(): Promise<void> {
    const tracking = this.trip()?.tracking;
    if (tracking?.status === 'in_progress' && tracking.lastEvent.type === 'missed' && !this.refreshRequired()) {
      await this.submitAction({
        type: 'recover',
        expectedStatus: tracking.status,
        expectedCheckpointIndex: tracking.currentCheckpointIndex,
      });
    }
  }

  async skipDroppedConnection(): Promise<void> {
    const tracking = this.trip()?.tracking;
    if (tracking?.status === 'in_progress' && tracking.lastEvent.type === 'dropped' && !this.refreshRequired()) {
      await this.submitAction({
        type: 'skip',
        expectedStatus: tracking.status,
        expectedCheckpointIndex: tracking.currentCheckpointIndex,
      });
    }
  }

  tripStatus(): 'not_started' | TripTrackingStatus | 'invalid' {
    const tracking = this.trip()?.tracking;
    if (!tracking) {
      return 'not_started';
    }
    return ['not_started', 'in_progress', 'completed'].includes(tracking.status)
      ? tracking.status
      : 'invalid';
  }

  getCurrentCheckpoint(): {
    title: string;
    location: string;
    expectedTime: string;
    currentAction: string;
    nextAction: string;
    dayNumber: number;
    dayCheckpointIndex: number;
    checkpointNumber: number;
    overallCheckpointIndex: number;
    ongoingDate: number | object | null;
    delayHrs: number;
    visitStatus: 'visited' | 'not_visited';
    onTime: boolean | null;
    onTrack: boolean | null;
  } {
    const checkpoints = this.getCheckpoints();
    const tracking = this.trip()?.tracking;
    const index = Math.max(0, Math.min(tracking?.currentCheckpointIndex ?? 0, checkpoints.length - 1));
    const current = checkpoints[index] ?? {
      dayNumber: 0,
      dayIndex: 0,
      dayCheckpointIndex: 0,
      checkpointNumber: 0,
      overallCheckpointIndex: 0,
      checkpointName: 'Unknown location',
      time: '--',
      description: 'No activity details',
    };
    const checkpointState = tracking?.checkpointStates?.[index];
    const next = checkpoints[index + 1];
    const status = this.tripStatus();
    let nextAction = next ? `${next.description} (${next.checkpointName}, ${next.time})` : 'Complete the final checkpoint';

    if (status === 'not_started') {
      nextAction = current.description;
    } else if (tracking?.lastEvent.type === 'missed') {
      nextAction = /departure|board|depart/i.test(current.description)
        ? 'Book the next departure to continue'
        : 'Replan the missed checkpoint to continue';
    } else if (tracking?.lastEvent.type === 'dropped') {
      nextAction = 'Skip this connection and continue';
    } else if (status === 'completed') {
      nextAction = 'Trip complete';
    }

    return {
      title: this.getStatusLabel(status),
      location: current.checkpointName,
      expectedTime: current.time,
      currentAction: status === 'not_started'
        ? 'Trip is ready to start'
        : status === 'in_progress' && this.isDelayTriggered()
          ? `${current.description} (trip delay trigger active at ${tracking?.driftHrs ?? 0} hours)`
          : current.description,
      nextAction,
      dayNumber: current.dayNumber,
      dayCheckpointIndex: current.dayCheckpointIndex,
      checkpointNumber: current.checkpointNumber,
      overallCheckpointIndex: current.overallCheckpointIndex,
      ongoingDate: tracking?.currentCheckpoint?.ongoingDate ?? null,
      delayHrs: checkpointState?.delayHrs ?? 0,
      visitStatus: checkpointState?.status ?? 'not_visited',
      onTime: checkpointState?.onTime ?? null,
      onTrack: checkpointState?.onTrack ?? null,
    };
  }

  getProgressPercent(): number {
    const count = this.getCheckpointCount();
    const tracking = this.trip()?.tracking;
    if (tracking?.status === 'completed') {
      return 100;
    }
    const index = Math.max(0, Math.min(tracking?.currentCheckpointIndex ?? 0, count - 1));
    return count > 1 ? (index / (count - 1)) * 100 : 0;
  }

  getCheckpointCount(): number {
    return this.getCheckpoints().length;
  }

  getDriftHours(): number {
    return this.trip()?.tracking?.driftHrs ?? 0;
  }

  getCurrentOngoingDate(): number | null {
    const ongoingDate = this.trip()?.tracking?.currentCheckpoint?.ongoingDate;
    return typeof ongoingDate === 'number' ? ongoingDate : null;
  }

  isDelayTriggered(): boolean {
    const tracking = this.trip()?.tracking;
    return tracking?.delayTriggered ?? this.getDriftHours() >= 5;
  }

  getCheckpointStates(): CheckpointTracking[] {
    return this.trip()?.tracking?.checkpointStates ?? [];
  }

  getTripTitle(): string {
    const trip = this.trip();
    const planName = trip?.['planName'];
    return typeof planName === 'string' && planName.trim() ? planName : `Trip ${trip?.tripId ?? this.loadedTripId}`;
  }

  private async submitAction(action: TripTrackingAction): Promise<void> {
    const tripId = this.loadedTripId;
    if (!tripId || this.actionPending() || this.refreshRequired() || !this.trip()) {
      return;
    }

    this.actionPending.set(true);
    this.error.set('');
    try {
      const result = await this.database.updateTripTracking(tripId, action);
      if (result.kind === 'committed') {
        this.trip.set(result.trip);
        this.decision.set(this.getSavedActionMessage(result.trip));
      } else if (result.kind === 'rejected') {
        this.trip.set(result.trip);
        this.refreshRequired.set(result.refreshRequired);
        this.decision.set('Firebase did not confirm this update. Your trip is still shown; reload before continuing.');
      } else {
        this.trip.set(null);
        this.loadedTripId = '';
        this.notFound.set(true);
        this.decision.set('This trip no longer exists in Firebase.');
      }
    } catch (error) {
      this.error.set(this.getErrorMessage(error, 'Could not save this trip update.'));
      this.decision.set('Update was not confirmed. Reload the trip before trying again.');
      this.refreshRequired.set(true);
    } finally {
      this.actionPending.set(false);
    }
  }

  private getCheckpoints(): TripCheckpoint[] {
    const trip = this.trip();
    if (!trip) {
      return [];
    }
    let overallCheckpointIndex = 0;
    return trip.days.flatMap((day, dayIndex) => day.activities.map((activity, dayCheckpointIndex) => ({
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

  private getStatusLabel(status: ReturnType<TravelMockComponent['tripStatus']>): string {
    switch (status) {
      case 'not_started': return 'Ready to start';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Trip Complete';
      case 'invalid': return 'Trip status unavailable';
    }
  }

  private getSavedActionMessage(trip: TripRecord): string {
    const event = trip.tracking?.lastEvent;
    if (trip.tracking?.status === 'completed') {
      return 'Trip complete. This trip cannot be restarted.';
    }
    switch (event?.type) {
      case 'started': return 'Trip started and saved to Firebase.';
      case 'on_time': return 'On-time checkpoint saved.';
      case 'delayed': return `Checkpoint delay saved. Total drift: ${trip.tracking?.driftHrs ?? 0} hours.`;
      case 'missed': return 'Missed checkpoint saved. Recover to continue.';
      case 'recovered': return 'Recovery saved. Two hours added to total drift.';
      case 'dropped': return 'Dropped checkpoint saved. Skip to continue.';
      case 'skipped': return 'Skipped checkpoint saved.';
      default: return 'Trip update saved to Firebase.';
    }
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}