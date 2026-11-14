import { Injectable, signal } from '@angular/core';
import { ValidationResponse } from '../models/travel.models';

@Injectable({ providedIn: 'root' })
export class TripStateService {
  readonly validationResult = signal<ValidationResponse | null>(null);
  readonly originalPrompt = signal('');
}
