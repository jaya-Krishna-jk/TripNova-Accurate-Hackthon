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
