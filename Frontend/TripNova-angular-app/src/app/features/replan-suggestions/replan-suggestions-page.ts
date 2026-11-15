import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReplanService } from '../../core/services/replan.service';
import { ReplanAlternative } from '../../core/models/replan.models';

/**
 * Re-itinerary options shown after a delay alert. Cards stay high level:
 * the day-wise itinerary is only shown on the replan details page.
 */
@Component({
  selector: 'app-replan-suggestions-page',
  imports: [RouterLink],
  templateUrl: './replan-suggestions-page.html',
})
export class ReplanSuggestionsPage implements OnInit {
  private readonly replan = inject(ReplanService);
  private readonly router = inject(Router);

  protected readonly response = this.replan.response();
  protected readonly options: ReplanAlternative[] = this.response?.alternatives ?? [];

  private readonly optionIcons = ['compress', 'star', 'update'];

  ngOnInit(): void {
    if (!this.response) {
      this.router.navigate(['/']);
    }
  }

  protected optionIcon(index: number): string {
    return this.optionIcons[index % this.optionIcons.length];
  }

  protected totalCost(option: ReplanAlternative): string {
    const total = option.budgetBreakdown?.total;
    if (total === null || total === undefined || total === '') return '';
    return typeof total === 'number' ? `₹${total.toLocaleString('en-IN')}` : total;
  }

  protected showFullItinerary(option: ReplanAlternative): void {
    this.replan.selectedOption.set(option);
    this.router.navigate(['/replan-details']);
  }
}
