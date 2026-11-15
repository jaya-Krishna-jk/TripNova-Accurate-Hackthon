import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ReplanAlternative, ReplanResponse } from '../models/replan.models';

/**
 * API access and state for the re-itinerary (delay) flow.
 *
 * Deliberately independent of `TravelApiService` / `TripStateService`, which
 * belong to the new-plan flow, so neither flow can overwrite the other's state.
 */
@Injectable({ providedIn: 'root' })
export class ReplanService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  /** Last replan response; read by the replan suggestions and details pages. */
  readonly response = signal<ReplanResponse | null>(null);
  /** Alternative the traveller opened with "Show full itinerary". */
  readonly selectedOption = signal<ReplanAlternative | null>(null);

  requestOptions(tripId: string): Observable<ReplanResponse> {
    return this.http.post<ReplanResponse>(
      `${this.baseUrl}/trips/${encodeURIComponent(tripId)}/replan`,
      null,
    );
  }

  getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return `Could not reach the TripNova API at ${this.baseUrl || 'the current origin'}. Make sure the backend is running.`;
      }
      if (error.status === 404) {
        return 'We could not find this trip, so no recommendations are available.';
      }
      if (error.status === 409) {
        return 'Your trip is no longer delayed beyond the alert threshold, so there is nothing to re-plan.';
      }
      return `Could not prepare the recommendations (${error.status}). Please try again.`;
    }
    return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
  }
}
