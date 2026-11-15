import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ReplanService } from '../../core/services/replan.service';
import { LooseValue } from '../../core/models/travel.models';
import { ReplanDay } from '../../core/models/replan.models';
import { RealtimeDatabaseService, ReplanDayInput } from '../../realtime-database.service';

type ApplyStatus = 'closed' | 'confirm' | 'saving' | 'saved' | 'error';

interface BudgetSegment {
  name: string;
  amount: LooseValue;
  color: string;
  /** Share of the numeric category total, 0 when the amount is not numeric. */
  percent: number;
}

/** Day-wise view of one re-itinerary option chosen on the replan suggestions page. */
@Component({
  selector: 'app-replan-details-page',
  imports: [RouterLink],
  templateUrl: './replan-details-page.html',
  host: { '(document:keydown.escape)': 'closeApplyDialog()' },
})
export class ReplanDetailsPage implements OnInit {
  private readonly replan = inject(ReplanService);
  private readonly router = inject(Router);
  private readonly database = inject(RealtimeDatabaseService);

  protected readonly response = this.replan.response();
  protected readonly option = this.replan.selectedOption();

  protected readonly days: ReplanDay[] = this.option?.days ?? [];
  protected readonly selectedDay = signal(this.days[0]?.day ?? 1);
  protected readonly currentDay = computed(
    () => this.days.find((d) => d.day === this.selectedDay()) ?? this.days[0] ?? null,
  );

  /** "Book This Journey" here updates the existing trip in place; it never creates a new trip ID. */
  protected readonly applyStatus = signal<ApplyStatus>('closed');
  protected readonly applyError = signal('');

  private readonly segmentColors = ['bg-slate-900', 'bg-amber-500', 'bg-emerald-600', 'bg-sky-500', 'bg-slate-400', 'bg-rose-400'];

  protected readonly budgetSegments: BudgetSegment[] = this.buildBudgetSegments();

  ngOnInit(): void {
    if (!this.response || !this.option) {
      this.router.navigate([this.response ? '/replan-suggestions' : '/']);
    }
  }

  protected get totalBudget(): LooseValue {
    return this.option?.budgetBreakdown?.total ?? null;
  }

  protected get travelerCount(): number | null {
    return this.response?.trip?.travelerCount ?? null;
  }

  protected selectDay(day: number): void {
    this.selectedDay.set(day);
  }

  protected openApplyDialog(): void {
    this.applyError.set('');
    this.applyStatus.set('confirm');
  }

  protected closeApplyDialog(): void {
    const status = this.applyStatus();
    if (status === 'saving') return;
    if (status === 'saved') {
      this.backToTrip();
      return;
    }
    this.applyStatus.set('closed');
  }

  /** Replaces the remaining itinerary of the existing trip with this option. */
  protected async applyToTrip(): Promise<void> {
    const response = this.response;
    const option = this.option;
    if (!response || !option || this.applyStatus() === 'saving') return;

    this.applyStatus.set('saving');
    this.applyError.set('');
    try {
      const result = await this.database.applyReplan(response.tripId, {
        optionId: option.optionId,
        optionName: option.optionName,
        expectedCheckpointName: response.currentCheckpoint.name,
        expectedDayNumber: response.currentCheckpoint.dayNumber,
        days: this.days.map((day): ReplanDayInput => ({ ...day })),
      });
      if (result.kind === 'applied') {
        this.applyStatus.set('saved');
        return;
      }
      this.applyError.set(
        result.kind === 'not-found'
          ? 'We could not find this trip, so it was not updated.'
          : 'Your trip has moved on since these recommendations were prepared, so it was not updated. Go back to your trip and request new recommendations.',
      );
      this.applyStatus.set('error');
    } catch (error) {
      this.applyError.set(
        error instanceof Error && error.message
          ? `Could not update your trip: ${error.message}`
          : 'Could not update your trip. Please try again.',
      );
      this.applyStatus.set('error');
    }
  }

  /** The options are spent once applied, so clear them before returning home. */
  protected backToTrip(): void {
    this.replan.response.set(null);
    this.replan.selectedOption.set(null);
    this.router.navigate(['/']);
  }

  /** Formats an AI-supplied amount: numbers as INR, strings as-is, empty when unknown. */
  protected money(value: LooseValue | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    return typeof value === 'number' ? `₹${value.toLocaleString('en-IN')}` : value;
  }

  protected text(value: LooseValue | undefined): string {
    return value === null || value === undefined ? '' : String(value);
  }

  protected stopLabel(stop: unknown): string {
    if (typeof stop === 'string') return stop;
    if (stop && typeof stop === 'object') {
      const s = stop as Record<string, unknown>;
      return String(s['name'] ?? s['place'] ?? s['location'] ?? '');
    }
    return String(stop ?? '');
  }

  protected statusLabel(status: string | null | undefined): string {
    return (status ?? '').replace(/_/g, ' ');
  }

  protected statusClass(status: string | null | undefined): string {
    switch (status) {
      case 'VERIFIED':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'RECOMMENDED':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  }

  protected transportIcon(mode: string | null | undefined): string {
    const lower = (mode ?? '').toLowerCase();
    if (lower.includes('flight') || lower.includes('air')) return 'flight';
    if (lower.includes('train') || lower.includes('rail')) return 'train';
    if (lower.includes('bus')) return 'directions_bus';
    if (lower.includes('walk')) return 'directions_walk';
    return 'directions_car';
  }

  protected tipIcon(category: string | null | undefined): string {
    const lower = (category ?? '').toLowerCase();
    if (lower.includes('weather')) return 'device_thermostat';
    if (lower.includes('transport') || lower.includes('rebook')) return 'directions_car';
    if (lower.includes('safety') || lower.includes('health')) return 'health_and_safety';
    if (lower.includes('hotel') || lower.includes('stay')) return 'hotel';
    if (lower.includes('time') || lower.includes('timing')) return 'schedule';
    return 'lightbulb';
  }

  protected severityClass(severity: string | null | undefined): string {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800';
      case 'WARNING':
        return 'bg-amber-100 text-amber-900';
      default:
        return 'bg-sky-100 text-sky-800';
    }
  }

  private buildBudgetSegments(): BudgetSegment[] {
    const categories = (this.option?.budgetBreakdown?.categories ?? []).filter((c) => c?.name);
    const sum = categories.reduce((acc, c) => acc + (typeof c.amount === 'number' ? c.amount : 0), 0);
    return categories.map((c, i) => ({
      name: c.name,
      amount: c.amount,
      color: this.segmentColors[i % this.segmentColors.length],
      percent: typeof c.amount === 'number' && sum > 0 ? (c.amount / sum) * 100 : 0,
    }));
  }
}
