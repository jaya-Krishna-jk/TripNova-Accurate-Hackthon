import { Injectable, signal } from '@angular/core';
import { ChatResponse, PlanDetails, TravelPlan, ValidationResponse } from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class TripStateService {
  readonly validationResult = signal<ValidationResponse | null>(null);
  readonly originalPrompt = signal('');
  readonly chatResponse = signal<ChatResponse | null>(null);
  readonly selectedPlan = signal<TravelPlan | null>(null);
  readonly planDetails = signal<PlanDetails | null>(null);
}
