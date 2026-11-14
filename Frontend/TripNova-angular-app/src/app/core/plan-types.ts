export type ItemKind = 'TRANSPORT' | 'STAY' | 'MEAL' | 'SIGHTSEEING' | 'WAYPOINT';
export type LegOutcome = 'ON_TIME' | 'DELAYED' | 'MISSED' | 'DROPPED';
export type TripStatus = 'OK' | 'AT_RISK' | 'CRITICAL' | 'PLAN_B' | 'UNRESOLVED';

export interface RawPlan {
  planId: string;
  planType: string;
  planName: string;
  source: string;
  destination: string;
  durationDays: number;
  summary: {
    description: string;
    estimatedCost: number;
    transportMode: string;
    hotelCategory: string;
    bestFor: string;
  };
  highlights: string[];
  days: RawDay[];
}

export interface RawDay {
  day: number;
  theme: string;
  daySummary: string;
  activities: RawActivity[];
}

export interface RawActivity {
  time: string;
  place: string;
  description: string;
}

export interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  description: string;
  placeName: string;
  kind: ItemKind;
  fixed: boolean;
  optional: boolean;
  plannedStart: string;
  end: string;
  lat?: number;
  lon?: number;
  legId?: string;
  note?: string;
}

export interface PlannedTrip {
  planId: string;
  planType: string;
  planName: string;
  source: string;
  destination: string;
  durationDays: number;
  summary: RawPlan['summary'];
  highlights: string[];
  items: ItineraryItem[];
}

export interface Booking {
  busTicketBooked?: boolean;
  hotelBooked?: boolean;
  hotelFreeCancellationDeadline?: string;
  lateArrivalCutoff?: string;
}

export interface Checkpoint {
  label: string;
  lat: number;
  lon: number;
  plannedTime: string;
}

export interface TransportLeg {
  legId: string;
  fromItemId: string;
  toItemId: string;
  fromName: string;
  toName: string;
  plannedDeparture: string;
  plannedArrival: string;
  mode: 'BUS' | 'TRAIN' | 'FLIGHT' | 'CAB' | 'OTHER';
  waypoints: Checkpoint[];
}

export interface CatchPoint {
  id: string;
  type: 'TRANSPORT_DEPARTURE' | 'FIXED_SLOT';
  itemId: string;
  legId?: string;
  at: string;
  prompt: string;
}

export interface LegState {
  legId: string;
  outcome: LegOutcome;
  delayMin: number;
  nextDepartureIso?: string;
  replacement?: {
    mode: TransportLeg['mode'];
    departureIso: string;
    arrivalIso: string;
    costInr: number;
  };
}

export interface TripSignals {
  legStates: Record<string, LegState>;
  slotOverrides: Record<string, { extraMin: number }>;
}

export interface TripOption {
  id: string;
  label: string;
  type: 'REBOOK' | 'KEEP_SHIFT' | 'PLAN_B' | 'REPLACE' | 'SKIP';
  costDeltaInr?: number;
  note?: string;
}

export interface TripAssessment {
  status: TripStatus;
  summary: string;
  delayMin: number;
  forecastArrivalIso?: string;
  items: ItineraryItem[];
  options: TripOption[];
}

export interface ParsedPlan {
  trip: PlannedTrip;
  legs: TransportLeg[];
  catchPoints: CatchPoint[];
  warnings: string[];
}

export interface DemoConfig {
  startDate: string;
  tz: string;
}
