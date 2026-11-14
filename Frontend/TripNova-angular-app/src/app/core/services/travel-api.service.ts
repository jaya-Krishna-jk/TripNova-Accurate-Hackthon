import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ChatRequest,
  ChatResponse,
  PlanDetails,
  PlanDetailsRequest,
  TravelRequest,
  ValidationResponse,
} from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class TravelApiService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/+$/, '');

  validate(message: string): Observable<ValidationResponse> {
    const body: ChatRequest = { message: message.trim() };
    return this.http.post<ValidationResponse>(`${this.baseUrl}/travel/validate`, body);
  }

  chat(request: TravelRequest): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.baseUrl}/travel/chat`, request);
  }

  planDetails(request: PlanDetailsRequest): Observable<PlanDetails> {
    return this.http.post<PlanDetails>(`${this.baseUrl}/travel/plan-details`, request);
  }

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
