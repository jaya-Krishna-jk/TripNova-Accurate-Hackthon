import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TravelApiService } from '../../core/services/travel-api.service';
import { TripStateService } from '../../core/services/trip-state.service';
import { ChatResponse, ExtractedTripData, TravelRequest } from '../../core/models/travel.models';

interface ParameterCard {
  label: string;
  field: string;
  value: string | null;
  detected: boolean;
  subtitle: string;
}

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
  protected budget = 0;
  protected travellerType = '';
  protected mealPreference = '';

  protected missingFields: string[] = [];
  protected parameterCards: ParameterCard[] = [];

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

  ngOnInit(): void {
    const validation = this.tripState.validationResult();
    if (!validation) {
      this.router.navigate(['/']);
      return;
    }

    const data = validation.extractedData;
    this.missingFields = validation.missingFields;

    this.source = data.source ?? '';
    this.destination = data.destination ?? '';
    this.startDate = data.startDate ?? '';
    this.endDate = data.endDate ?? '';
    this.travellerCount = data.travellerCount ?? 0;
    this.childrenCount = data.childrenCount ?? 0;
    this.seniorCitizenCount = data.seniorCitizenCount ?? 0;
    this.budget = data.budget ?? 0;
    this.travellerType = data.travellerType ?? '';
    this.mealPreference = data.mealPreference ?? '';

    this.buildParameterCards(data);
  }

  private buildParameterCards(data: ExtractedTripData): void {
    this.parameterCards = [
      {
        label: 'Route',
        field: 'source',
        value: data.source && data.destination ? `${data.source} → ${data.destination}` : null,
        detected: !this.missingFields.includes('source') && !this.missingFields.includes('destination'),
        subtitle: data.source && data.destination ? `${data.source} to ${data.destination}` : 'Route not detected',
      },
      {
        label: 'Travel Dates',
        field: 'startDate',
        value: data.startDate && data.endDate ? `${data.startDate} — ${data.endDate}` : data.startDate || data.endDate || null,
        detected: !this.missingFields.includes('startDate') && !this.missingFields.includes('endDate'),
        subtitle: data.startDate ? 'Calendar range provided' : 'Calendar range required',
      },
      {
        label: 'Travellers',
        field: 'travellerCount',
        value: data.travellerCount ? `${data.travellerCount} Travellers` : null,
        detected: !this.missingFields.includes('travellerCount'),
        subtitle: data.travellerType ?? 'Type not specified',
      },
      {
        label: 'Total Budget',
        field: 'budget',
        value: data.budget ? `₹${data.budget.toLocaleString('en-IN')} INR` : null,
        detected: !this.missingFields.includes('budget'),
        subtitle: data.budget ? 'Confirm total' : 'Budget required',
      },
      {
        label: 'Travel Style',
        field: 'travellerType',
        value: data.travellerType ?? null,
        detected: !this.missingFields.includes('travellerType'),
        subtitle: data.travellerType ?? 'Not detected',
      },
      {
        label: 'Meal Type',
        field: 'mealPreference',
        value: data.mealPreference ?? null,
        detected: !this.missingFields.includes('mealPreference'),
        subtitle: data.mealPreference ?? 'Not specified',
      },
    ];
  }

  protected isMissing(field: string): boolean {
    return this.missingFields.includes(field);
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
    return this.missingFields.includes(field) ? this.fieldErrorMessages[field] ?? 'This field is required' : '';
  }

  protected get detectedCount(): number {
    return this.parameterCards.filter((c) => c.detected).length;
  }

  protected get missingCount(): number {
    return this.missingFields.length;
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
      budget: this.budget,
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
