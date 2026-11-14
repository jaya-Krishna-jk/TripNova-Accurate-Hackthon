import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { TravelApiService } from '../../core/services/travel-api.service';

interface ContextAnchor {
  origin: string;
  group: string;
  budget: string;
  duration: string;
}

interface QuickPrompt {
  label: string;
  icon: string;
  text: string;
  anchor: ContextAnchor;
}

type RequestStatus = 'idle' | 'loading' | 'success' | 'error';

/**
 * Main screen: the AI trip prompt from the Stitch design.
 * "Generate My Trip" posts the free-text prompt to `POST /travel/chat` via TravelApiService.
 * The API response is not rendered yet.
 */
@Component({
  selector: 'app-plan-trip-page',
  imports: [FormsModule],
  templateUrl: './plan-trip-page.html',
})
export class PlanTripPage {
  private readonly travelApi = inject(TravelApiService);

  protected readonly quickPrompts: QuickPrompt[] = [
    {
      label: 'Family Vacation',
      icon: 'family_restroom',
      text: 'Curate a scenic 5-day family road and mountain getaway from Hyderabad to Ooty with private nursery visits, child-friendly lake boating, and vegetarian comfort food.',
      anchor: { origin: 'From: Hyderabad', group: 'Family (2 Adults, 2 Kids)', budget: 'Budget: ₹55,000', duration: '5 Days (Dec)' },
    },
    {
      label: 'Friends Trip',
      icon: 'group',
      text: 'Plan a 4-day lively friends road trip from Bangalore to Coorg including plantation homestays, trekking, waterfall rappelling, and bonfire barbecues.',
      anchor: { origin: 'From: Bangalore', group: 'Friends (4 Adults)', budget: 'Budget: ₹40,000', duration: '4 Days (Weekend)' },
    },
    {
      label: 'Weekend Getaway',
      icon: 'wb_sunny',
      text: 'Design a relaxing 3-day weekend retreat from Kochi to Munnar tea highlands with peaceful spa sessions, scenic valley walks, and authentic Kerala vegetarian feasts.',
      anchor: { origin: 'From: Kochi', group: 'Couple (2 Adults)', budget: 'Budget: ₹32,000', duration: '3 Days (Fri-Sun)' },
    },
    {
      label: 'Adventure Trip',
      icon: 'hiking',
      text: 'Build an active 6-day heritage and wilderness expedition from Delhi across Jaipur and desert dunes with camel treks, fort tours, and luxury royal camp stays.',
      anchor: { origin: 'From: Delhi', group: 'Solo Traveler', budget: 'Budget: ₹45,000', duration: '6 Days' },
    },
  ];

  protected prompt =
    'Plan a 5-day family trip from Hyderabad to Ooty for 4 people with pure vegetarian dining, scenic Nilgiri tea estate resort, and toy train reservations in late December.';

  protected readonly anchor = signal<ContextAnchor>({
    origin: 'From: Hyderabad',
    group: 'Family (4 People)',
    budget: 'Budget: ₹80,000',
    duration: '5 Days',
  });

  protected readonly status = signal<RequestStatus>('idle');
  protected readonly errorMessage = signal('');

  protected readonly isLoading = computed(() => this.status() === 'loading');
  protected readonly canSubmit = computed(() => !this.isLoading() && this.prompt.trim().length > 0);

  protected applyQuickPrompt(quick: QuickPrompt): void {
    this.prompt = quick.text;
    this.anchor.set(quick.anchor);
    this.status.set('idle');
    this.errorMessage.set('');
    document.getElementById('main-ai-prompt')?.focus();
  }

  protected async generateTrip(): Promise<void> {
    const message = this.prompt.trim();
    if (!message || this.isLoading()) {
      return;
    }

    this.status.set('loading');
    this.errorMessage.set('');

    try {
      // Response handling is intentionally out of scope for this screen.
      await firstValueFrom(this.travelApi.chat(message));
      this.status.set('success');
    } catch (error) {
      this.errorMessage.set(this.travelApi.getErrorMessage(error));
      this.status.set('error');
    }
  }

}
