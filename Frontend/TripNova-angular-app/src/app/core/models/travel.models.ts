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
