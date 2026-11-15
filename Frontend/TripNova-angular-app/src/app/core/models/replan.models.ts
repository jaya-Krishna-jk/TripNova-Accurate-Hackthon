/**
 * Contracts for the re-itinerary (delay) flow:
 * `POST /trips/{tripId}/replan` in `smart-travel-backend/app/replan.py`.
 *
 * Kept separate from `travel.models.ts` so the new-plan flow is unaffected.
 */
import {
  BudgetBreakdown,
  DayAccommodation,
  DayActivity,
  DayDining,
  DayTransport,
  LooseValue,
  RouteOverview,
  TravelTip,
  WeatherAndPacking,
} from './travel.models';

export interface ReplanDelay {
  totalDelayHrs: number | null;
  thresholdHrs: number | null;
  delayTriggered: boolean | null;
  lastTrackingUpdate: string | null;
}

export interface ReplanCheckpoint {
  name: string | null;
  dayNumber: number | null;
  originallyPlannedTime: string | null;
  estimatedActualTime: string | null;
}

/** Who is travelling and on what budget; any field may be missing on older trips. */
export interface ReplanTripProfile {
  planName?: string | null;
  source?: string | null;
  destination?: string | null;
  travelMode?: string | null;
  travelerCount?: number | null;
  budget?: number | null;
  mealPreference?: string | null;
  hotelPreference?: string | null;
}

export interface ReplanImpact {
  keptPlaces?: string[];
  skippedPlaces?: string[];
  returnTimeChange?: string;
  tradeOffs?: string;
}

/** A re-planned day. Only the base fields are guaranteed; the rest is AI-enriched. */
export interface ReplanDay {
  day: number;
  theme: string;
  daySummary?: string;
  estimatedCost?: LooseValue;
  activities?: Partial<DayActivity>[];
  transport?: Partial<DayTransport> | null;
  dining?: Partial<DayDining>[];
  accommodation?: Partial<DayAccommodation> | null;
  conciergeNote?: string;
  precautions?: string[];
}

/** One alternative re-itinerary for the remaining part of the trip. */
export interface ReplanAlternative {
  optionId: string;
  optionName: string;
  strategy?: string;
  description?: string;
  impact?: ReplanImpact;
  /** Day-wise itinerary: shown only on the replan details page. */
  days?: ReplanDay[];
  routeOverview?: RouteOverview | null;
  budgetBreakdown?: BudgetBreakdown | null;
  travelTips?: TravelTip[];
  weatherAndPacking?: WeatherAndPacking | null;
}

/** Response from `POST /trips/{tripId}/replan`. */
export interface ReplanResponse {
  tripId: string;
  userId?: string;
  trip?: ReplanTripProfile;
  delay: ReplanDelay;
  currentCheckpoint: ReplanCheckpoint;
  alternatives: ReplanAlternative[];
}
