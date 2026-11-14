import { Component, computed, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripStateService } from '../../core/services/trip-state.service';
import { ChatResponse, TravelPlan, TripDetails } from '../../core/models/travel.models';
import { DatePipe, DecimalPipe, NgClass } from '@angular/common';

@Component({
  selector: 'app-itinerary-suggestions-page',
  imports: [RouterLink, DatePipe, DecimalPipe, NgClass],
  templateUrl: './itinerary-suggestions-page.html',
})
export class ItinerarySuggestionsPage implements OnInit {
  private readonly tripState = inject(TripStateService);
  private readonly router = inject(Router);

  protected tripDetails!: TripDetails;
  protected plans: TravelPlan[] = [];

  protected readonly badgeStyles: Record<string, { bg: string; text: string; border?: string }> = {
    'Budget Saver': { bg: 'bg-[#ECFDF5]', text: 'text-[#059669]' },
    'Comfort First': { bg: 'bg-[#FEF9C3]', text: 'text-[#7F6410]' },
    'Premium Luxury': { bg: 'bg-primary-container', text: 'text-on-primary' },
    'Local Hidden Gems': { bg: 'bg-tertiary-container', text: 'text-on-tertiary-container' },
  };

  protected readonly transportIcons: Record<string, string> = {
    bus: 'directions_bus',
    train: 'train',
    flight: 'flight',
    jeep: 'directions_car',
  };

  protected readonly lowestCostPlanId = computed(() => {
    if (!this.plans.length) return '';
    return this.plans.reduce((min, p) =>
      p.summary.estimatedCost < min.summary.estimatedCost ? p : min
    ).planId;
  });

  ngOnInit(): void {
    const response = this.tripState.chatResponse();
    if (!response) {
      this.router.navigate(['/']);
      return;
    }
    this.tripDetails = response.tripDetails;
    this.plans = response.plans;
  }

  protected getBadge(planType: string) {
    return this.badgeStyles[planType] ?? { bg: 'bg-surface-container', text: 'text-on-surface' };
  }

  protected getTransportIcon(transportMode: string): string {
    const lower = transportMode.toLowerCase();
    if (lower.includes('flight')) return 'flight';
    if (lower.includes('train')) return 'train';
    if (lower.includes('bus')) return 'directions_bus';
    return 'directions_car';
  }

  protected isRecommended(plan: TravelPlan): boolean {
    return plan.planType === 'Comfort First';
  }

  protected isLowestPrice(plan: TravelPlan): boolean {
    return plan.planId === this.lowestCostPlanId();
  }

  protected formatDate(dateStr: string): Date {
    return new Date(dateStr);
  }

  protected selectPlan(plan: TravelPlan): void {
    // Will navigate to detailed day-wise itinerary in a future iteration
    console.log('Selected plan:', plan.planId);
  }
}
