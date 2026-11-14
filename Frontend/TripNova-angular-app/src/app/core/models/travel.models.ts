/**
 * Contracts for the Smart Travel API (`smart-travel-backend/app/models.py`).
 */

/** Body for `POST /travel/chat` — a free-text trip request. */
export interface ChatRequest {
  message: string;
}
