import { Component, computed, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RealtimeDatabaseService } from '../../realtime-database.service';
import { PlanDetails, TravelPlan, TripDetails } from '../../core/models/travel.models';

type DialogStatus = 'idle' | 'saving' | 'saved' | 'error';

/** Confirmation pop-up that collects optional booking details and saves the trip to Firebase. */
@Component({
  selector: 'app-booking-dialog',
  imports: [FormsModule],
  templateUrl: './booking-dialog.html',
  host: { '(document:keydown.escape)': 'close()' },
})
export class BookingDialog {
  private readonly database = inject(RealtimeDatabaseService);

  readonly details = input.required<PlanDetails>();
  readonly plan = input<TravelPlan | null>(null);
  readonly tripDetails = input<TripDetails | null>(null);
  readonly closed = output<void>();

  protected readonly status = signal<DialogStatus>('idle');
  protected readonly errorMessage = signal('');
  protected readonly tripId = signal('');
  protected readonly isSaving = computed(() => this.status() === 'saving');

  // All fields are optional.
  protected travelName = '';
  protected boardingTime = '';
  protected hotelName = '';
  protected checkInTime = '';
  protected contactPhone = '';
  protected contactEmail = '';

  protected close(): void {
    if (!this.isSaving()) {
      this.closed.emit();
    }
  }

  protected async submit(): Promise<void> {
    if (this.isSaving()) return;

    this.status.set('saving');
    this.errorMessage.set('');

    const details = this.details();
    const plan = this.plan();

    try {
      const tripId = await this.database.createTrip({
        ...details,
        planType: plan?.planType ?? null,
        tripDetails: this.tripDetails(),
        status: 'booked',
        booking: {
          travelName: this.travelName.trim(),
          boardingTime: this.boardingTime,
          hotelName: this.hotelName.trim(),
          checkInTime: this.checkInTime,
          contactPhone: this.contactPhone.trim(),
          contactEmail: this.contactEmail.trim(),
        },
      });
      this.tripId.set(tripId);
      this.status.set('saved');
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error && error.message
          ? `Could not save your trip: ${error.message}`
          : 'Could not save your trip. Please try again.',
      );
      this.status.set('error');
    }
  }
}
