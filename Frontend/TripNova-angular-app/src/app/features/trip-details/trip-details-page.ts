import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TravelApiService } from '../../core/services/travel-api.service';
import { TripStateService } from '../../core/services/trip-state.service';
import { ChatResponse, TravelRequest } from '../../core/models/travel.models';

type PageStatus = 'idle' | 'loading' | 'success' | 'error';

/* eslint-disable @typescript-eslint/naming-convention */
@Component({
  selector: 'app-trip-details-page',
  imports: [FormsModule],
  templateUrl: './trip-details-page.html',
})
export class TripDetailsPage implements OnInit {
  private readonly travelApi = inject(TravelApiService);
  private readonly tripState = inject(TripStateService);
  private readonly router = inject(Router);

  protected readonly Math = Math;

  protected readonly status = signal<PageStatus>('idle');
  protected readonly errorMessage = signal('');
  protected readonly isLoading = computed(() => this.status() === 'loading');

  protected source = '';
  protected destination = '';
  protected startDate = '';
  protected endDate = '';
  protected travellerCount = 0;
  protected childrenCount = 0;
  protected seniorCitizenCount = 0;
  protected budget: number | null = null;
  protected travellerType = '';
  protected mealPreference = '';

  protected missingFields: string[] = [];

  protected readonly travellerTypes = [
    { value: 'Family', icon: 'escalator_warning', label: 'Family', desc: 'Kids & multi-gen' },
    { value: 'Friends', icon: 'groups', label: 'Friends', desc: 'Treks & outings' },
    { value: 'Solo', icon: 'person', label: 'Solo', desc: 'Flexible exploration' },
    { value: 'Couple', icon: 'favorite', label: 'Couple', desc: 'Romantic getaway' },
    { value: 'Business', icon: 'business_center', label: 'Business', desc: 'Work travel' },
  ];

  protected readonly mealOptions = [
    { value: 'Veg', label: 'Pure Vegetarian', icon: 'eco', desc: 'Separate cookware & certified Jain-friendly kitchens' },
    { value: 'Non-Veg', label: 'Non-Vegetarian', icon: '', desc: 'Regional specialties & continental cuisine' },
  ];

  /** Fields the trip request cannot be generated without. */
  private readonly requiredFields = [
    'source',
    'destination',
    'startDate',
    'endDate',
    'travellerCount',
    'travellerType',
    'budget',
    'mealPreference',
  ];

  ngOnInit(): void {
    const validation = this.tripState.validationResult();
    if (!validation) {
      this.router.navigate(['/']);
      return;
    }

    const data = validation.extractedData;

    this.source = (data.source ?? '').trim();
    this.destination = (data.destination ?? '').trim();
    this.startDate = this.toIsoDate(data.startDate);
    this.endDate = this.toIsoDate(data.endDate);
    this.travellerCount = this.toNumber(data.travellerCount) ?? 0;
    this.childrenCount = this.toNumber(data.childrenCount) ?? 0;
    this.seniorCitizenCount = this.toNumber(data.seniorCitizenCount) ?? 0;
    this.budget = this.toNumber(data.budget);
    this.travellerType = data.travellerType ?? '';
    this.mealPreference = data.mealPreference ?? '';

    // Flag what the API reported plus any required field that arrived unusable
    // (e.g. a zero budget or an unparseable date).
    const flagged = new Set(validation.missingFields ?? []);
    for (const field of this.requiredFields) {
      if (!this.hasValue(field)) flagged.add(field);
    }
    this.missingFields = [...flagged];
  }

  /**
   * Coerces an AI-extracted amount to a positive number. Accepts numbers and
   * strings such as "30000", "₹30,000", "30k" or "1.5 lakh"; null when unusable.
   */
  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
    if (typeof value !== 'string') return null;

    const match = value.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k|lakhs?|lacs?|l)?\b/i);
    if (!match) return null;
    const unit = (match[2] ?? '').toLowerCase();
    const multiplier = unit === 'k' ? 1_000 : unit ? 100_000 : 1;
    const amount = Math.round(parseFloat(match[1]) * multiplier);
    return amount > 0 ? amount : null;
  }

  /** Normalises an AI-extracted date to the `yyyy-MM-dd` form a date input needs. */
  private toIsoDate(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return '';
    const iso = value.trim().match(/^\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${parsed.getFullYear()}-${month}-${day}`;
  }

  /** Whether the form currently holds a usable value for the field. */
  private hasValue(field: string): boolean {
    switch (field) {
      case 'source':
        return !!this.source.trim();
      case 'destination':
        return !!this.destination.trim();
      case 'startDate':
        return !!this.startDate;
      case 'endDate':
        return !!this.endDate;
      case 'travellerCount':
        return this.travellerCount > 0;
      case 'budget':
        return !!this.budget && this.budget > 0;
      case 'travellerType':
        return !!this.travellerType;
      case 'mealPreference':
        return !!this.mealPreference;
      default:
        // Optional counters (children, seniors): zero is a valid answer.
        return true;
    }
  }

  /** True while a flagged field is still empty; clears as soon as the user fills it in. */
  protected isMissing(field: string): boolean {
    return this.missingFields.includes(field) && !this.hasValue(field);
  }

  private readonly fieldErrorMessages: Record<string, string> = {
    source: 'Source city is required',
    destination: 'Destination is required',
    startDate: 'Start date is required',
    endDate: 'End date is required',
    travellerCount: 'Number of travellers is required',
    travellerType: 'Please select a travel type',
    budget: 'Budget amount is required',
    mealPreference: 'Please select a meal preference',
  };

  protected fieldError(field: string): string {
    return this.isMissing(field) ? this.fieldErrorMessages[field] ?? 'This field is required' : '';
  }

  /** Flagged fields the user has not filled in yet. */
  protected get missingCount(): number {
    return this.missingFields.filter((field) => this.isMissing(field)).length;
  }

  protected get routeLabel(): string {
    if (this.source && this.destination) {
      return `${this.source} → ${this.destination}`;
    }
    return 'Route';
  }

  protected editPrompt(): void {
    this.router.navigate(['/']);
  }

  protected incrementAdults(): void {
    this.travellerCount = Math.min(this.travellerCount + 1, 20);
  }

  protected decrementAdults(): void {
    const minAdults = this.childrenCount > 0 ? 1 : 1;
    const adults = this.travellerCount - this.childrenCount;
    if (adults > minAdults) {
      this.travellerCount--;
    }
  }

  protected incrementChildren(): void {
    this.childrenCount = Math.min(this.childrenCount + 1, 10);
    this.travellerCount++;
  }

  protected decrementChildren(): void {
    if (this.childrenCount > 0) {
      this.childrenCount--;
      this.travellerCount = Math.max(this.travellerCount - 1, 1);
    }
  }

  protected get adultCount(): number {
    return Math.max(this.travellerCount - this.childrenCount, 0);
  }

  protected async submitTrip(): Promise<void> {
    if (this.isLoading()) return;

    this.status.set('loading');
    this.errorMessage.set('');

    const request: TravelRequest = {
      source: this.source,
      destination: this.destination,
      startDate: this.startDate,
      endDate: this.endDate,
      travellerCount: this.travellerCount,
      travellerType: this.travellerType,
      budget: this.budget ?? 0,
      mealPreference: this.mealPreference,
      childrenCount: this.childrenCount,
      seniorCitizenCount: this.seniorCitizenCount,
      preferences: [],
      hotelPreference: '3 Star Hotel',
    };

    try {
      const response = await firstValueFrom(this.travelApi.chat(request));
      this.tripState.chatResponse.set(response as ChatResponse);
      this.status.set('success');
      this.router.navigate(['/itinerary-suggestions']);
    } catch (error) {
      this.errorMessage.set(this.travelApi.getErrorMessage(error));
      this.status.set('error');
    }
  }
}
