import {
  Component,
  computed,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  signal,
  ViewChild,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom, Subscription } from 'rxjs';
import { ReplanService } from '../../core/services/replan.service';
import { TravelApiService } from '../../core/services/travel-api.service';
import { TripStateService } from '../../core/services/trip-state.service';
import { ChatResponse, TravelRequest } from '../../core/models/travel.models';
import { RealtimeDatabaseService } from '../../realtime-database.service';

interface QuickPrompt {
  label: string;
  icon: string;
  text: string;
}

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

interface TripActivityView {
  overallNumber: number;
  activityNumber: number;
  activityCount: number;
  time: string;
  place: string;
  description: string;
  type: string;
  icon: string;
  status: 'done' | 'current' | 'upcoming';
  isSelected: boolean;
}

interface TripDayView {
  ordinal: number;
  heading: string;
  theme?: string;
  isSelected: boolean;
  status: 'completed' | 'current' | 'upcoming';
  doneCount: number;
  activities: TripActivityView[];
}

interface TravelerTripView {
  statusLabel: string;
  isPreview: boolean;
  dayPositionLabel: string;
  activityPositionLabel: string;
  overallPositionLabel: string;
  currentDayTheme?: string;
  dayPercent: number;
  overallPercent: number;
  completedCount: number;
  railAccessibleLabel: string;
  railPositionPercent: number;
  totalActivities: number;
  days: TripDayView[];
  currentActivity: TripActivityView;
  nextActivity?: TripActivityView;
  delayTriggeredLabel: string;
  driftHoursLabel: string;
  delayTone: 'triggered' | 'not-triggered' | 'unknown';
}

type TravelerTripState =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'error' }
  | { kind: 'live'; trip: TravelerTripView };

const NOT_PROVIDED = 'Not provided';
const TRIP_ID = 'TN-3UP9HH';
const OWNER_ID = 'jk';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

@Component({
  selector: 'app-plan-trip-page',
  imports: [FormsModule],
  templateUrl: './plan-trip-page.html',
})
export class PlanTripPage implements OnInit, OnDestroy {
  private readonly travelApi = inject(TravelApiService);
  private readonly tripState = inject(TripStateService);
  private readonly router = inject(Router);
  private readonly database = inject(RealtimeDatabaseService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly replan = inject(ReplanService);
  private replanSubscription: Subscription | undefined;
  @ViewChild('delayDialog') private delayDialog?: ElementRef<HTMLDialogElement>;
  private stopTripListener: (() => void) | undefined;
  private destroyed = false;
  private delayTransitionBaseline: boolean | undefined;
  private delayDialogOpenToken = 0;
  private previouslyFocusedElement: HTMLElement | null = null;

  protected readonly quickPrompts: QuickPrompt[] = [
    {
      label: 'Family Vacation',
      icon: 'family_restroom',
      text: 'Curate a scenic 5-day family road and mountain getaway from Hyderabad to Ooty with private nursery visits, child-friendly lake boating, and vegetarian comfort food.',
    },
    {
      label: 'Friends Trip',
      icon: 'group',
      text: 'Plan a 4-day lively friends road trip from Bangalore to Coorg including plantation homestays, trekking, waterfall rappelling, and bonfire barbecues.',
    },
    {
      label: 'Weekend Getaway',
      icon: 'wb_sunny',
      text: 'Design a relaxing 3-day weekend retreat from Kochi to Munnar tea highlands with peaceful spa sessions, scenic valley walks, and authentic Kerala vegetarian feasts.',
    },
    {
      label: 'Adventure Trip',
      icon: 'hiking',
      text: 'Build an active 6-day heritage and wilderness expedition from Delhi across Jaipur and desert dunes with camel treks, fort tours, and luxury royal camp stays.',
    },
  ];

  protected prompt =
    'Plan a 5-day family trip from Hyderabad to Ooty for 4 people with pure vegetarian dining, scenic Nilgiri tea estate resort, and toy train reservations in late December.';

  protected readonly status = signal<RequestStatus>('idle');
  protected readonly errorMessage = signal('');

  protected readonly travelerTripState = signal<TravelerTripState>({ kind: 'loading' });
  protected readonly delayAlertMessage = signal('');
  /** Re-itinerary request started from the delay dialog. */
  protected readonly replanLoading = signal(false);
  protected readonly replanError = signal('');
  protected readonly isLoading = computed(() => this.status() === 'loading');
  protected readonly canSubmit = computed(() => !this.isLoading() && this.prompt.trim().length > 0);

  ngOnInit(): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.startTripListener();
  }

  protected retryTripListener(): void {
    this.startTripListener();
  }

  private startTripListener(): void {
    if (this.destroyed) {
      return;
    }
    this.resetDelayAlert();
    this.stopTripListener?.();
    this.travelerTripState.set({ kind: 'loading' });
    this.stopTripListener = this.database.subscribeToTravelerHomeTrip(
      (snapshot) => {
        if (this.destroyed) {
          return;
        }
        const projectedTrip = this.projectTravelerTrip(snapshot.exists() ? snapshot.val() : null);
        this.travelerTripState.set(projectedTrip);
        this.processDelayTransition(projectedTrip);
      },
      () => {
        if (this.destroyed) {
          return;
        }
        this.resetDelayAlert();
        this.travelerTripState.set({ kind: 'error' });
      },
    );
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.cancelReplanRequest();
    this.resetDelayAlert();
    this.stopTripListener?.();
    this.stopTripListener = undefined;
  }

  private processDelayTransition(state: TravelerTripState): void {
    if (state.kind !== 'live') {
      this.resetDelayAlert();
      return;
    }

    if (state.trip.delayTone !== 'triggered') {
      this.delayTransitionBaseline = state.trip.delayTone === 'not-triggered' ? false : undefined;
      return;
    }

    const shouldOpen = this.delayTransitionBaseline !== true;
    this.delayTransitionBaseline = true;
    if (shouldOpen) {
      const hours = state.trip.driftHoursLabel === NOT_PROVIDED
        ? 'an unknown number of hours'
        : `${state.trip.driftHoursLabel} hours`;
      this.delayAlertMessage.set(
        `Your trip was delayed by ${hours}. Here is the recommended plan. Plan your things appropriately. Don't panic. Use the AI suggestions for a safe and better plan.`,
      );
      this.queueDelayDialogOpen();
    }
  }

  private queueDelayDialogOpen(): void {
    const token = ++this.delayDialogOpenToken;
    window.requestAnimationFrame(() => {
      if (this.destroyed || token !== this.delayDialogOpenToken || this.delayTransitionBaseline !== true) {
        return;
      }

      const dialog = this.delayDialog?.nativeElement;
      if (!dialog || dialog.open) {
        return;
      }

      const activeElement = document.activeElement;
      this.previouslyFocusedElement = activeElement instanceof HTMLElement ? activeElement : null;
      dialog.showModal();
      dialog.querySelector<HTMLElement>('[autofocus]')?.focus();
    });
  }

  protected dismissDelayDialog(): void {
    const dialog = this.delayDialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
  }

  /**
   * Delay dialog CTA: fetches the re-itinerary options for the live trip and
   * opens the replan suggestions page. Uses ReplanService state only, so the
   * new-plan flow (TripStateService) is untouched.
   */
  protected viewRecommendations(): void {
    if (this.replanLoading()) {
      return;
    }
    this.replanLoading.set(true);
    this.replanError.set('');
    this.replanSubscription = this.replan.requestOptions(TRIP_ID).subscribe({
      next: (response) => {
        this.replanLoading.set(false);
        this.replan.response.set(response);
        this.replan.selectedOption.set(null);
        this.router.navigate(['/replan-suggestions']);
      },
      error: (error: unknown) => {
        this.replanLoading.set(false);
        this.replanError.set(this.replan.getErrorMessage(error));
      },
    });
  }

  /** Drops an in-flight replan request, e.g. when the dialog is closed. */
  private cancelReplanRequest(): void {
    this.replanSubscription?.unsubscribe();
    this.replanSubscription = undefined;
    this.replanLoading.set(false);
    this.replanError.set('');
  }

  protected onDelayDialogClosed(): void {
    this.cancelReplanRequest();
    const previousElement = this.previouslyFocusedElement;
    this.previouslyFocusedElement = null;
    if (previousElement?.isConnected) {
      previousElement.focus();
      return;
    }
    document.getElementById('traveler-trip-heading')?.focus();
  }

  private resetDelayAlert(): void {
    this.delayTransitionBaseline = undefined;
    this.delayDialogOpenToken += 1;
    const dialog = this.delayDialog?.nativeElement;
    if (dialog?.open) {
      dialog.close();
    }
  }

  private projectTravelerTrip(value: unknown): TravelerTripState {
    if (value === null) {
      return { kind: 'empty' };
    }
    if (!isObjectRecord(value)) {
      return { kind: 'unavailable', message: 'Trip data is unavailable.' };
    }

    // Check ownership before inspecting or projecting any other trip field.
    if (value['userId'] !== OWNER_ID) {
      return { kind: 'unavailable', message: 'No eligible trip is available.' };
    }
    if (value['tripId'] !== undefined && value['tripId'] !== TRIP_ID) {
      return { kind: 'unavailable', message: 'Trip data is unavailable.' };
    }

    const rawTracking = value['tracking'];
    let lifecycle: 'not_started' | 'in_progress';
    let currentIndex: number | undefined;
    let tracking: Record<string, unknown> | undefined;

    if (rawTracking === undefined) {
      if (value['status'] !== 'booked') {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
      lifecycle = 'not_started';
    } else {
      if (!isObjectRecord(rawTracking)) {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
      tracking = rawTracking;
      const trackingStatus = tracking['status'];
      if (trackingStatus === 'completed') {
        return { kind: 'empty' };
      }
      if (trackingStatus !== 'not_started' && trackingStatus !== 'in_progress') {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
      lifecycle = trackingStatus;

      const storedIndex = tracking['currentCheckpointIndex'];
      if (storedIndex !== undefined) {
        if (!Number.isInteger(storedIndex) || (storedIndex as number) < 0) {
          return { kind: 'unavailable', message: 'Trip data is unavailable.' };
        }
        currentIndex = storedIndex as number;
      }

      if (
        tracking['delayTriggered'] !== undefined &&
        typeof tracking['delayTriggered'] !== 'boolean'
      ) {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
      if (
        tracking['driftHrs'] !== undefined &&
        (typeof tracking['driftHrs'] !== 'number' || !Number.isFinite(tracking['driftHrs']))
      ) {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
    }

    const rawDays = value['days'];
    if (!Array.isArray(rawDays) || rawDays.length === 0) {
      return { kind: 'unavailable', message: 'Trip data is unavailable.' };
    }
    const preview = lifecycle === 'not_started';
    const selectedIndex = preview ? 0 : currentIndex!;
    const activities: TripActivityView[] = [];
    const days: TripDayView[] = [];
    let overallIndex = 0;
    for (let dayIndex = 0; dayIndex < rawDays.length; dayIndex += 1) {
      const rawDay = rawDays[dayIndex];
      if (!isObjectRecord(rawDay) || !Array.isArray(rawDay['activities'])) {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
      if (
        (rawDay['day'] !== undefined &&
          rawDay['day'] !== null &&
          (typeof rawDay['day'] !== 'number' ||
            !Number.isInteger(rawDay['day']) ||
            rawDay['day'] < 1)) ||
        (rawDay['theme'] !== undefined &&
          rawDay['theme'] !== null &&
          typeof rawDay['theme'] !== 'string')
      ) {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }

      const dayStartIndex = overallIndex;
      const dayActivities: TripActivityView[] = [];
      for (const rawActivity of rawDay['activities']) {
        if (!isObjectRecord(rawActivity)) {
          return { kind: 'unavailable', message: 'Trip data is unavailable.' };
        }
        const fields = ['time', 'place', 'description', 'type'] as const;
        if (fields.some((field) => rawActivity[field] !== undefined && rawActivity[field] !== null && typeof rawActivity[field] !== 'string')) {
          return { kind: 'unavailable', message: 'Trip data is unavailable.' };
        }
        const rawType = rawActivity['type'] as string | null | undefined;
        const activity: TripActivityView = {
          overallNumber: overallIndex + 1,
          activityNumber: dayActivities.length + 1,
          activityCount: 0,
          time: this.notProvidedUnlessString(rawActivity['time']),
          place: this.notProvidedUnlessString(rawActivity['place']),
          description: this.notProvidedUnlessString(rawActivity['description']),
          type: rawType == null
            ? NOT_PROVIDED
            : this.activityTypeLabel(rawType),
          icon: this.activityTypeIcon(rawType),
          status: preview || overallIndex > selectedIndex
            ? 'upcoming'
            : overallIndex === selectedIndex
              ? 'current'
              : 'done',
          isSelected: overallIndex === selectedIndex,
        };
        dayActivities.push(activity);
        activities.push(activity);
        overallIndex += 1;
      }
      for (const activity of dayActivities) {
        activity.activityCount = dayActivities.length;
      }

      const storedDay = rawDay['day'];
      const theme = this.notProvidedUnlessString(rawDay['theme']);
      const dayIsSelected = selectedIndex >= dayStartIndex && selectedIndex < overallIndex;
      days.push({
        ordinal: dayIndex + 1,
        heading: `Day ${typeof storedDay === 'number' ? storedDay : dayIndex + 1}`,
        ...(theme !== NOT_PROVIDED ? { theme } : {}),
        isSelected: dayIsSelected,
        status: preview
          ? 'upcoming'
          : dayIsSelected
            ? 'current'
            : overallIndex <= selectedIndex
              ? 'completed'
              : 'upcoming',
        doneCount: dayActivities.filter((activity) => activity.status === 'done').length,
        activities: dayActivities,
      });
    }
    if (activities.length === 0) {
      return { kind: 'unavailable', message: 'Trip data is unavailable.' };
    }

    if (lifecycle === 'in_progress') {
      if (currentIndex === undefined || currentIndex >= activities.length) {
        return { kind: 'unavailable', message: 'Trip data is unavailable.' };
      }
    } else if (currentIndex !== undefined && currentIndex >= activities.length) {
      return { kind: 'unavailable', message: 'Trip data is unavailable.' };
    }

    const currentActivity = activities[selectedIndex];
    const nextActivity = preview ? undefined : activities[selectedIndex + 1];
    const delayTriggered = tracking?.['delayTriggered'];
    const currentDay = days.find((day) => day.isSelected);
    if (!currentDay) {
      return { kind: 'unavailable', message: 'Trip data is unavailable.' };
    }
    const currentActivityPosition = currentActivity.activityNumber;
    const overallPositionLabel = `Overall activity ${selectedIndex + 1} of ${activities.length}`;
    const dayPositionLabel = `Day ${currentDay.ordinal} of ${days.length}`;
    const activityPositionLabel =
      `Activity ${currentActivityPosition} of ${currentActivity.activityCount}`;
    const railAccessibleLabel = preview
      ? `Preview only: Day ${currentDay.ordinal} of ${days.length}, Activity ${currentActivityPosition} of ${currentActivity.activityCount}, overall activity ${selectedIndex + 1} of ${activities.length}.`
      : `Current progress: ${dayPositionLabel}, ${activityPositionLabel}, overall activity ${selectedIndex + 1} of ${activities.length}.`;

    return {
      kind: 'live',
      trip: {
        statusLabel: preview ? 'Planned / Not started' : 'In progress',
        isPreview: preview,
        dayPositionLabel,
        activityPositionLabel,
        overallPositionLabel,
        ...(currentDay.theme ? { currentDayTheme: currentDay.theme } : {}),
        dayPercent: Math.round((currentDay.ordinal / days.length) * 100),
        overallPercent: Math.round(((selectedIndex + 1) / activities.length) * 100),
        completedCount: preview ? 0 : selectedIndex,
        railAccessibleLabel,
        railPositionPercent: activities.length > 1
          ? (selectedIndex / (activities.length - 1)) * 100
          : 0,
        totalActivities: activities.length,
        days,
        currentActivity,
        nextActivity,
        delayTriggeredLabel: typeof delayTriggered === 'boolean' ? String(delayTriggered) : NOT_PROVIDED,
        driftHoursLabel: typeof tracking?.['driftHrs'] === 'number'
          ? String(tracking['driftHrs'])
          : NOT_PROVIDED,
        delayTone: delayTriggered === true
          ? 'triggered'
          : delayTriggered === false
            ? 'not-triggered'
            : 'unknown',
      },
    };
  }

  private notProvidedUnlessString(value: unknown): string {
    return typeof value === 'string' ? value : NOT_PROVIDED;
  }

  private activityTypeLabel(type: string): string {
    switch (type) {
      case 'Transport':
        return 'travel';
      case 'Meal':
        return 'eating';
      case 'Accommodation':
        return 'hotel';
      default:
        return type;
    }
  }

  private activityTypeIcon(type: string | null | undefined): string {
    switch (type) {
      case 'Transport':
        return 'directions_bus';
      case 'Meal':
        return 'restaurant';
      case 'Accommodation':
        return 'hotel';
      default:
        return 'location_on';
    }
  }

  protected applyQuickPrompt(quick: QuickPrompt): void {
    this.prompt = quick.text;
    this.status.set('idle');
    this.errorMessage.set('');
    document.getElementById('main-ai-prompt')?.focus();
  }

  protected async generateTrip(): Promise<void> {
    const message = this.prompt.trim();
    if (!message || this.isLoading()) {
      return;
    }

    this.status.set('loading');
    this.errorMessage.set('');

    try {
      const validation = await firstValueFrom(this.travelApi.validate(message));

      if (!validation.isValid) {
        this.tripState.validationResult.set(validation);
        this.tripState.originalPrompt.set(message);
        this.status.set('idle');
        this.router.navigate(['/trip-details']);
        return;
      }

      const data = validation.extractedData;
      const request: TravelRequest = {
        source: data.source ?? '',
        destination: data.destination ?? '',
        startDate: data.startDate ?? '',
        endDate: data.endDate ?? '',
        travellerCount: data.travellerCount ?? 1,
        travellerType: data.travellerType ?? 'Solo',
        budget: data.budget ?? 30000,
        mealPreference: data.mealPreference ?? 'Veg',
        childrenCount: data.childrenCount ?? 0,
        seniorCitizenCount: data.seniorCitizenCount ?? 0,
        preferences: [],
        hotelPreference: '3 Star Hotel',
      };

      const response = await firstValueFrom(this.travelApi.chat(request));
      this.tripState.chatResponse.set(response as ChatResponse);
      this.status.set('success');
      this.router.navigate(['/itinerary-suggestions']);
    } catch (error) {
      this.errorMessage.set(this.travelApi.getErrorMessage(error));
      this.status.set('error');
    }
  }
}
