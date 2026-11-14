/**
 * Contracts for the Smart Travel API (`smart-travel-backend/app/models.py`).
 */

/** Body for `POST /travel/validate` and the initial prompt. */
export interface ChatRequest {
  message: string;
}

/** Response from `POST /travel/validate`. */
export interface ValidationResponse {
  isValid: boolean;
  missingFields: string[];
  extractedData: ExtractedTripData;
}

/** Fields the AI extracts from the user's prompt. Null means not detected. */
export interface ExtractedTripData {
  source: string | null;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  travellerCount: number | null;
  travellerType: string | null;
  budget: number | null;
  mealPreference: string | null;
  childrenCount: number | null;
  seniorCitizenCount: number | null;
}

/** Body for `POST /travel/chat` — structured trip request. */
export interface TravelRequest {
  source: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellerCount: number;
  travellerType: string;
  budget: number;
  mealPreference: string;
  childrenCount: number;
  seniorCitizenCount: number;
  preferences: string[];
  hotelPreference: string;
}

/** Summary block inside each plan option. */
export interface PlanSummary {
  description: string;
  estimatedCost: number;
  transportMode: string;
  hotelCategory: string;
  bestFor: string;
}

/** A single itinerary plan option returned by the AI. */
export interface TravelPlan {
  planId: string;
  planType: string;
  planName: string;
  summary: PlanSummary;
  highlights: string[];
}

/** Trip details echoed back in the chat response. */
export interface TripDetails {
  source: string;
  destination: string;
  startDate: string;
  endDate: string;
  travellerCount: number;
  travellerType: string;
  budget: number;
  mealPreference: string;
  childrenCount: number;
  seniorCitizenCount: number;
  preferences: string[];
  hotelPreference: string;
  durationDays: number;
}

/** Response from `POST /travel/chat`. */
export interface ChatResponse {
  tripDetails: TripDetails;
  plans: TravelPlan[];
}

/** Body for `POST /travel/plan-details` — the selected plan plus trip context. */
export interface PlanDetailsRequest {
  planId: string;
  planType: string;
  planName: string;
  source: string;
  destination: string;
  durationDays: number;
  summary: PlanSummary;
  highlights: string[];
  /** Trip context (travellers, budget, dates) used to ground the dossier. */
  tripDetails?: TripDetails;
  /** Existing day-wise itinerary; the backend generates one when omitted. */
  days?: BaseItineraryDay[];
}

/** A day of the base itinerary, before enrichment. */
export interface BaseItineraryDay {
  day: number;
  theme: string;
  daySummary: string;
  activities: { time: string; place: string; description: string }[];
}

/** AI-generated value that may arrive as a number, a display string ("570 km") or null. */
export type LooseValue = number | string | null;

export interface PlanOverview {
  source: string;
  destination: string;
  durationDays: number;
  travelMode: string;
  totalDistance: LooseValue;
  highlights: string[];
  totalBudget: LooseValue;
  travelerCount: number | null;
  badges: string[];
}

export interface DayActivity {
  time: string;
  place: string;
  type: string;
  description: string;
  duration: LooseValue;
  estimatedCost: LooseValue;
  bookingStatus: string;
}

export interface DayTransport {
  mode: string;
  description: string;
  estimatedDuration: LooseValue;
  estimatedCost: LooseValue;
}

export interface DayDining {
  meal: string;
  restaurant: string;
  cuisine: string;
  recommendedDishes: string[];
  estimatedCost: LooseValue;
}

export interface DayAccommodation {
  name: string | null;
  category: string | null;
  estimatedCost: LooseValue;
  bookingStatus: string;
}

export interface ItineraryDay {
  day: number;
  theme: string;
  daySummary: string;
  estimatedCost: LooseValue;
  activities: DayActivity[];
  transport: DayTransport | null;
  dining: DayDining[];
  accommodation: DayAccommodation | null;
  conciergeNote: string;
  precautions: string[];
}

export interface RouteOverview {
  totalDistance: LooseValue;
  estimatedDuration: LooseValue;
  stops: unknown[];
  description: string;
}

export interface BudgetCategory {
  name: string;
  amount: LooseValue;
}

export interface BudgetBreakdown {
  total: LooseValue;
  perPerson: LooseValue;
  categories: BudgetCategory[];
  savings: string[];
}

export interface TravelTip {
  category: string;
  title: string;
  description: string;
  /** `INFO`, `WARNING` or `CRITICAL`. */
  severity: string;
}

export interface WeatherAndPacking {
  forecastAvailable: boolean;
  temperature: LooseValue;
  conditions: string | null;
  packingEssentials: string[];
}

export interface PlanVerification {
  status: string;
  verifiedItems: string[];
  unverifiedItems: string[];
  warnings: string[];
}

/** Response from `POST /travel/plan-details` — the detailed day-wise dossier. */
export interface PlanDetails {
  planId: string;
  planName: string;
  overview: PlanOverview;
  days: ItineraryDay[];
  routeOverview: RouteOverview | null;
  budgetBreakdown: BudgetBreakdown | null;
  travelTips: TravelTip[];
  weatherAndPacking: WeatherAndPacking | null;
  verification: PlanVerification | null;
}
