import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ChatRequest } from '../models/travel.models';

/**
 * Service layer for the Smart Travel API.
 * Base URL comes from the environment config — never hardcode it in components.
 */
@Injectable({ providedIn: 'root' })
export class TravelApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  /**
   * Sends a free-text trip request to `POST /travel/chat`.
   * The response shape is left untyped for now; callers receive the raw JSON.
   */
  chat(message: string): Observable<unknown> {
    const body: ChatRequest = { message: message.trim() };
    return this.http.post<unknown>(`${this.baseUrl}/travel/chat`, body);
  }

  /** Converts an HTTP failure into a message that is safe to show in the UI. */
  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return `Could not reach the TripNova API at ${this.baseUrl || 'the current origin'}. Make sure the backend is running.`;
      }
      return `Request failed (${error.status}). Please try again.`;
    }
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}
