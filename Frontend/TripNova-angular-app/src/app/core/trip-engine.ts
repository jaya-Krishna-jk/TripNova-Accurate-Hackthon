import type { LegState, ParsedPlan, PlannedTrip, TripAssessment, TripOption, TripSignals, TransportLeg } from './plan-types';

function isParsedPlan(value: PlannedTrip | ParsedPlan): value is ParsedPlan {
  return 'legs' in value && 'catchPoints' in value && 'warnings' in value;
}

function getEffectiveLegTiming(leg: TransportLeg, legState?: LegState): { departure: string; arrival: string; delayMin: number } {
  if (!legState) {
    return { departure: leg.plannedDeparture, arrival: leg.plannedArrival, delayMin: 0 };
  }

  if (legState.outcome === 'ON_TIME') {
    return { departure: leg.plannedDeparture, arrival: leg.plannedArrival, delayMin: 0 };
  }

  if (legState.outcome === 'DELAYED') {
    const departure = new Date(leg.plannedDeparture);
    const arrival = new Date(leg.plannedArrival);
    const delayMin = Math.max(0, legState.delayMin || 0);
    const departureIso = new Date(departure.getTime() + delayMin * 60 * 1000).toISOString();
    const arrivalIso = new Date(arrival.getTime() + delayMin * 60 * 1000).toISOString();
    return { departure: departureIso, arrival: arrivalIso, delayMin };
  }

  if (legState.outcome === 'MISSED') {
    const next = legState.nextDepartureIso ?? leg.plannedDeparture;
    const departureMs = new Date(next).getTime();
    const plannedDurationMs = new Date(leg.plannedArrival).getTime() - new Date(leg.plannedDeparture).getTime();
    return { departure: next, arrival: new Date(departureMs + plannedDurationMs).toISOString(), delayMin: Math.max(0, (departureMs - new Date(leg.plannedDeparture).getTime()) / 60000) };
  }

  if (legState.outcome === 'DROPPED') {
    if (legState.replacement) {
      return {
        departure: legState.replacement.departureIso,
        arrival: legState.replacement.arrivalIso,
        delayMin: Math.max(0, (new Date(legState.replacement.arrivalIso).getTime() - new Date(leg.plannedArrival).getTime()) / 60000),
      };
    }

    return { departure: leg.plannedDeparture, arrival: leg.plannedArrival, delayMin: 9999 };
  }

  return { departure: leg.plannedDeparture, arrival: leg.plannedArrival, delayMin: 0 };
}

export class TripEngine {
  assess(plan: PlannedTrip | ParsedPlan, signals: Partial<TripSignals> = {}): TripAssessment {
    const parsed = isParsedPlan(plan) ? plan : { trip: plan, legs: [], catchPoints: [], warnings: [] };
    const trip = parsed.trip ?? plan;
    const legStates = signals.legStates ?? {};
    const slotOverrides = signals.slotOverrides ?? {};

    let worstDelay = 0;
    let status: TripAssessment['status'] = 'OK';
    const options: TripOption[] = [];

    for (const leg of parsed.legs.length > 0 ? parsed.legs : []) {
      const state = legStates[leg.legId];
      const timing = getEffectiveLegTiming(leg, state);
      worstDelay = Math.max(worstDelay, timing.delayMin);

      if (state?.outcome === 'DROPPED' && !state.replacement) {
        status = 'CRITICAL';
        options.push({ id: `rebook-${leg.legId}`, label: 'Choose replacement transport', type: 'REPLACE', note: 'Replacement required before continuing.' });
      }

      if ((state?.outcome === 'MISSED' || timing.delayMin > 60) && status !== 'CRITICAL') {
        status = 'AT_RISK';
      }

      if (state?.outcome === 'MISSED' && state.nextDepartureIso) {
        const nextDate = new Date(state.nextDepartureIso);
        if (nextDate.getUTCDate() !== new Date(leg.plannedDeparture).getUTCDate()) {
          status = 'PLAN_B';
        }
      }
    }

    if (parsed.catchPoints.length > 0) {
      for (const slot of parsed.catchPoints) {
        const override = slotOverrides[slot.itemId];
        if (override && override.extraMin > 0) {
          worstDelay = Math.max(worstDelay, override.extraMin);
          status = status === 'CRITICAL' ? 'CRITICAL' : 'AT_RISK';
          options.push({ id: `slot-${slot.itemId}`, label: 'Queue overrun applied', type: 'KEEP_SHIFT', note: `+${override.extraMin} min` });
        }
      }
    }

    if (status === 'OK' && worstDelay > 0) {
      status = 'AT_RISK';
    }

    const summary = status === 'PLAN_B'
      ? 'Plan B is recommended because the missed leg pushes the trip onto a later day.'
      : status === 'CRITICAL'
        ? 'The trip is at a critical threshold and needs immediate re-planning.'
        : status === 'AT_RISK'
          ? 'The trip is behind schedule and may require rebooking or time shifts.'
          : 'The current trip plan remains on schedule.';

    return {
      status,
      summary,
      delayMin: worstDelay,
      forecastArrivalIso: parsed.legs.length > 0 ? parsed.legs[parsed.legs.length - 1].plannedArrival : undefined,
      items: trip.items,
      options,
    };
  }
}

export const assessTrip = (plan: PlannedTrip | ParsedPlan, signals: Partial<TripSignals> = {}): TripAssessment => new TripEngine().assess(plan, signals);
