import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { TripStateService } from '../../core/services/trip-state.service';
import { ItineraryDay, LooseValue } from '../../core/models/travel.models';
import { BookingDialog } from './booking-dialog';
import { downloadPdfFile } from '../../core/utils/download-file';

interface BudgetSegment {
  name: string;
  amount: LooseValue;
  color: string;
  /** Share of the numeric category total, 0 when the amount is not numeric. */
  percent: number;
}

@Component({
  selector: 'app-itinerary-details-page',
  imports: [RouterLink, BookingDialog],
  templateUrl: './itinerary-details-page.html',
})
export class ItineraryDetailsPage implements OnInit {
  private readonly tripState = inject(TripStateService);
  private readonly router = inject(Router);

  protected readonly details = this.tripState.planDetails();
  protected readonly plan = this.tripState.selectedPlan();
  protected readonly tripDetails = this.tripState.chatResponse()?.tripDetails ?? null;

  protected readonly days: ItineraryDay[] = this.details?.days ?? [];
  protected readonly selectedDay = signal(this.days[0]?.day ?? 1);
  protected readonly currentDay = computed(
    () => this.days.find((d) => d.day === this.selectedDay()) ?? this.days[0] ?? null,
  );

  protected readonly bookingOpen = signal(false);

  private readonly segmentColors = ['bg-slate-900', 'bg-amber-500', 'bg-emerald-600', 'bg-sky-500', 'bg-slate-400', 'bg-rose-400'];

  protected readonly budgetSegments: BudgetSegment[] = this.buildBudgetSegments();

  ngOnInit(): void {
    if (!this.details) {
      this.router.navigate([this.tripState.chatResponse() ? '/itinerary-suggestions' : '/']);
    }
  }

  protected get durationDays(): number {
    return this.details?.overview?.durationDays || this.days.length;
  }

  protected get nights(): number {
    return Math.max(this.durationDays - 1, 0);
  }

  protected get totalBudget(): LooseValue {
    return (
      this.details?.budgetBreakdown?.total ??
      this.details?.overview?.totalBudget ??
      this.plan?.summary.estimatedCost ??
      null
    );
  }

  protected get travelerCount(): number | null {
    return this.details?.overview?.travelerCount ?? this.tripDetails?.travellerCount ?? null;
  }

  /** Amount left under the user's budget cap, when both figures are numeric. */
  protected get budgetBuffer(): number | null {
    const total = this.totalBudget;
    const cap = this.tripDetails?.budget;
    if (typeof total !== 'number' || !cap || cap <= total) return null;
    return cap - total;
  }

  protected get allocatedPercent(): number | null {
    const total = this.totalBudget;
    const cap = this.tripDetails?.budget;
    if (typeof total !== 'number' || !cap) return null;
    return Math.round((total / cap) * 1000) / 10;
  }

  /**
   * Calendar date of an itinerary day, counted from the trip start date
   * (day 1 = start date). Empty when the trip has no usable start date.
   */
  protected dayDate(day: number, weekday = true): string {
    const match = (this.tripDetails?.startDate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match || !Number.isFinite(day)) return '';
    // Built from parts so the date stays in local time (no UTC shift).
    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + day - 1);
    return date.toLocaleDateString('en-IN', {
      weekday: weekday ? 'short' : undefined,
      day: 'numeric',
      month: 'short',
      year: weekday ? 'numeric' : undefined,
    });
  }

  protected selectDay(day: number): void {
    this.selectedDay.set(day);
  }

  protected completeBooking(): void {
    this.router.navigate(['/']);
  }

  protected downloadItinerary(): void {
    if (!this.details) return;

    const lines = [
      this.details.planName || this.plan?.planName || 'TripNova itinerary',
      `${this.details.overview.source} to ${this.details.overview.destination}`,
      `${this.durationDays} days / ${this.nights} nights`,
      '',
    ];

    if (this.tripDetails) {
      lines.push(
        `Travel dates: ${this.tripDetails.startDate} to ${this.tripDetails.endDate}`,
        `Travellers: ${this.tripDetails.travellerCount}`,
        '',
      );
    }

    if (this.details.routeOverview) {
      lines.push('ROUTE OVERVIEW');
      if (this.details.routeOverview.stops.length) {
        lines.push(`Stops: ${this.details.routeOverview.stops.map((stop) => this.stopLabel(stop)).join(' -> ')}`);
      }
      if (this.details.routeOverview.description) lines.push(this.details.routeOverview.description);
      if (this.text(this.details.routeOverview.estimatedDuration)) {
        lines.push(`Estimated duration: ${this.text(this.details.routeOverview.estimatedDuration)}`);
      }
      lines.push('');
    }

    for (const day of this.days) {
      const date = this.dayDate(day.day, false);
      lines.push(`DAY ${day.day}${date ? ` · ${date}` : ''}: ${day.theme}`);
      if (day.daySummary) lines.push(day.daySummary);
      if (day.activities.length) {
        lines.push('Activities:');
        for (const activity of day.activities) {
          lines.push(`- ${activity.time} | ${activity.place} | ${activity.type}: ${activity.description}`);
        }
      }
      if (day.transport) {
        lines.push(`Transport: ${day.transport.mode} - ${day.transport.description}`);
      }
      for (const meal of day.dining) {
        lines.push(`Dining (${meal.meal}): ${meal.restaurant}${meal.cuisine ? ` - ${meal.cuisine}` : ''}`);
      }
      if (day.accommodation?.name || day.accommodation?.category) {
        lines.push(`Stay: ${day.accommodation.name || day.accommodation.category}`);
      }
      for (const precaution of day.precautions) lines.push(`Precaution: ${precaution}`);
      if (day.conciergeNote) lines.push(`Concierge note: ${day.conciergeNote}`);
      lines.push('');
    }

    if (this.details.travelTips.length) {
      lines.push('TRAVEL TIPS');
      for (const tip of this.details.travelTips) {
        lines.push(`- ${tip.title || tip.category}: ${tip.description}`);
      }
      lines.push('');
    }

    downloadPdfFile(
      `${this.details.planName || 'tripnova-itinerary'}.pdf`.replace(/[^\w.-]+/g, '-'),
      lines,
    );
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
    if (lower.includes('transport')) return 'directions_car';
    if (lower.includes('safety') || lower.includes('health')) return 'health_and_safety';
    if (lower.includes('payment') || lower.includes('money')) return 'qr_code_2';
    if (lower.includes('connect') || lower.includes('network')) return 'signal_cellular_alt';
    if (lower.includes('pack')) return 'backpack';
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
    const categories = (this.details?.budgetBreakdown?.categories ?? []).filter((c) => c?.name);
    const sum = categories.reduce((acc, c) => acc + (typeof c.amount === 'number' ? c.amount : 0), 0);
    return categories.map((c, i) => ({
      name: c.name,
      amount: c.amount,
      color: this.segmentColors[i % this.segmentColors.length],
      percent: typeof c.amount === 'number' && sum > 0 ? (c.amount / sum) * 100 : 0,
    }));
  }
}
