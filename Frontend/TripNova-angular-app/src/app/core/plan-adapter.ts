import { GEO_LOOKUP, ROUTE_WAYPOINTS } from './geo-data';
import type { CatchPoint, Checkpoint, DemoConfig, ItineraryItem, LegState, ParsedPlan, PlannedTrip, RawPlan, TransportLeg } from './plan-types';

const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeText(value: string | undefined | null): string {
  return (value ?? '').trim();
}

function toDateString(value: string): string {
  const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!match) {
    return new Date().toISOString().slice(0, 10);
  }
  return value;
}

function addDaysToDate(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const dateObject = new Date(Date.UTC(year, month - 1, day));
  dateObject.setUTCDate(dateObject.getUTCDate() + days);
  return dateObject.toISOString().slice(0, 10);
}

function formatIsoDateTime(date: string, timeMinutes: number, tz: string): string {
  const start = `${date}T00:00:00${tz}`;
  const base = new Date(start);
  base.setUTCMinutes(base.getUTCMinutes() + timeMinutes);
  const tzSign = tz.startsWith('-') ? '-' : '+';
  const tzMinutes = Math.abs(Number(tz.slice(1, 3)) * 60 + Number(tz.slice(4, 6)));
  const iso = new Date(base.getTime() - (base.getTimezoneOffset() * 60000)).toISOString();
  const datePart = iso.slice(0, 10);
  const timePart = iso.slice(11, 19);
  return `${datePart}T${timePart}${tzSign}${String(Math.floor(tzMinutes / 60)).padStart(2, '0')}:${String(tzMinutes % 60).padStart(2, '0')}`;
}

function parseClockTime(value: string): number | null {
  if (!value) return null;
  const raw = normalizeText(value).toUpperCase();
  const match24 = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw);
  if (match24) {
    return Number(match24[1]) * 60 + Number(match24[2]);
  }
  const match12 = /^(0?[1-9]|1[0-2]):([0-5]\d)\s?(AM|PM)$/.exec(raw);
  if (!match12) return null;
  const hours = Number(match12[1]);
  const minutes = Number(match12[2]);
  const meridiem = match12[3];
  const total = meridiem === 'AM' ? (hours === 12 ? 0 : hours) * 60 + minutes : ((hours === 12 ? 12 : hours + 12) * 60 + minutes);
  return total;
}

function normalizePlaceName(value: string): string {
  return normalizeText(value).replace(/\s+/g, ' ').toLowerCase();
}

function getGeoCoordinate(place: string): { lat?: number; lon?: number } {
  const normalized = normalizePlaceName(place);
  const match = GEO_LOOKUP[normalized];
  if (match) return { lat: match.lat, lon: match.lon };
  return {};
}

function detectKind(description: string, place: string): ItineraryItem['kind'] {
  const text = `${place} ${description}`.toLowerCase();
  const precedence: Array<{ kind: ItineraryItem['kind']; keywords: string[] }> = [
    { kind: 'WAYPOINT', keywords: ['enroute', 'en route'] },
    { kind: 'TRANSPORT', keywords: ['bus station', 'railway', 'junction', 'airport', 'depart', 'arrive in', 'return bus'] },
    { kind: 'STAY', keywords: ['hotel', 'check-in', 'check in', 'check-out', 'check out', 'resort', 'lodge'] },
    { kind: 'MEAL', keywords: ['eatery', 'canteen', 'restaurant', 'lunch', 'dinner', 'breakfast', 'thali'] },
    { kind: 'SIGHTSEEING', keywords: ['temple', 'gardens', 'waterfall', 'falls', 'market', 'darshan', 'silathoranam', 'fort', 'beach', 'museum'] },
  ];

  for (const entry of precedence) {
    if (entry.keywords.some((keyword) => text.includes(keyword))) {
      return entry.kind;
    }
  }

  return 'SIGHTSEEING';
}

function computeFixedFlag(kind: ItineraryItem['kind'], description: string, place: string): boolean {
  const text = `${place} ${description}`.toLowerCase();
  if (/darshan|venkateswara temple/i.test(text)) return true;
  if (kind === 'TRANSPORT') return true;
  if (kind === 'STAY') {
    const isCheckIn = /check-in|check in|hotel/i.test(text) && !/return to the hotel|wake up/i.test(text);
    return isCheckIn;
  }
  return false;
}

function makePromptForDeparture(leg: TransportLeg, departureItem: ItineraryItem): string {
  const time = new Date(leg.plannedDeparture).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `It is ${time}. The traveler is at ${departureItem.placeName}. Did they catch the ${leg.mode.toLowerCase()} to ${leg.toName}?`;
}

function makePromptForFixedSlot(item: ItineraryItem): string {
  const time = new Date(item.plannedStart).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  return `It is ${time}. The traveler is at ${item.placeName}. Did they complete the ${item.placeName} slot?`;
}

function assignWaypoints(fromName: string, toName: string, plannedDeparture: string, plannedArrival: string): Checkpoint[] {
  const key = `${fromName.toLowerCase()}|${toName.toLowerCase()}`;
  const route = ROUTE_WAYPOINTS[key];
  const start = new Date(plannedDeparture).getTime();
  const end = new Date(plannedArrival).getTime();
  const duration = Math.max(1, end - start);

  const points = route ?? [
    { lat: 0, lon: 0, label: 'A' },
    { lat: 0.5, lon: 0.3, label: 'B' },
    { lat: 1, lon: 0.6, label: 'C' },
    { lat: 1.4, lon: 1, label: 'D' },
  ];

  const waypoints: Checkpoint[] = [];
  for (let index = 0; index < points.length; index += 1) {
    const progressRatio = (index + 1) / (points.length + 1);
    const chunkTime = start + duration * progressRatio;
    waypoints.push({
      label: points[index].label,
      lat: points[index].lat,
      lon: points[index].lon,
      plannedTime: new Date(chunkTime).toISOString(),
    });
  }

  return waypoints;
}

function modeFromSummary(value: string): TransportLeg['mode'] {
  const text = value.toLowerCase();
  if (text.includes('flight')) return 'FLIGHT';
  if (text.includes('train')) return 'TRAIN';
  if (text.includes('cab') || text.includes('taxi')) return 'CAB';
  if (text.includes('bus')) return 'BUS';
  return 'OTHER';
}

function buildLegsForTrip(items: ItineraryItem[], summaryTransportMode: string): { legs: TransportLeg[]; warnings: string[] } {
  const transportItems = items.filter((item) => item.kind === 'TRANSPORT');
  const legs: TransportLeg[] = [];
  const warnings: string[] = [];

  for (let index = 0; index < transportItems.length - 1; index += 1) {
    const current = transportItems[index];
    const next = transportItems[index + 1];
    const currentText = `${current.description} ${current.placeName}`.toLowerCase();
    const isDeparture = /depart|leave|start/i.test(currentText) || (index === 0 && !/arrive|reach|return/i.test(currentText));
    const isArrival = /arrive|reach|destination|return/i.test(`${next.description} ${next.placeName}`.toLowerCase());
    if (!isDeparture || !isArrival) {
      continue;
    }

    const departureTime = new Date(current.plannedStart).getTime();
    const arrivalTime = new Date(next.plannedStart).getTime();
    if (Number.isNaN(departureTime) || Number.isNaN(arrivalTime)) {
      warnings.push(`Could not build leg between ${current.placeName} and ${next.placeName}.`);
      continue;
    }

    const leg: TransportLeg = {
      legId: `leg-${index + 1}`,
      fromItemId: current.id,
      toItemId: next.id,
      fromName: current.placeName,
      toName: next.placeName,
      plannedDeparture: current.plannedStart,
      plannedArrival: next.plannedStart,
      mode: modeFromSummary(summaryTransportMode),
      waypoints: assignWaypoints(current.placeName, next.placeName, current.plannedStart, next.plannedStart),
    };

    legs.push(leg);
  }

  if (legs.length === 0 && transportItems.length >= 2) {
    warnings.push('Transport leg pairing could not be inferred automatically.');
  }

  return { legs, warnings };
}

function parseRawPlan(raw: RawPlan, opts: DemoConfig): ParsedPlan {
  const warnings: string[] = [];
  const trip: PlannedTrip = {
    planId: raw.planId,
    planType: raw.planType,
    planName: raw.planName,
    source: raw.source,
    destination: raw.destination,
    durationDays: raw.durationDays,
    summary: raw.summary,
    highlights: raw.highlights ?? [],
    items: [],
  };

  const startDate = toDateString(opts.startDate);
  const allItems: ItineraryItem[] = [];

  for (const day of raw.days ?? []) {
    let previousMinutes = -1;
    let rolloverOffset = 0;

    for (let index = 0; index < day.activities.length; index += 1) {
      const activity = day.activities[index];
      const timeMinutes = parseClockTime(activity.time);
      if (timeMinutes === null) {
        warnings.push(`Could not parse time "${activity.time}" for ${activity.place}.`);
        continue;
      }

      if (previousMinutes >= 0 && timeMinutes < previousMinutes) {
        rolloverOffset += 1;
        warnings.push(`Time rollover detected for day ${day.day}: ${activity.time} is earlier than the previous item. The day was shifted forward by one day.`);
      }
      previousMinutes = timeMinutes;

      const effectiveDate = addDaysToDate(startDate, (day.day - 1) + rolloverOffset);
      const plannedStart = formatIsoDateTime(effectiveDate, timeMinutes, opts.tz);

      const kind = detectKind(activity.description, activity.place);
      const fixed = computeFixedFlag(kind, activity.description, activity.place);
      const item: ItineraryItem = {
        id: `d${day.day}-a${index + 1}`,
        day: day.day,
        time: activity.time,
        description: activity.description,
        placeName: activity.place,
        kind,
        fixed,
        optional: !fixed,
        plannedStart,
        end: plannedStart,
        ...getGeoCoordinate(activity.place),
      };

      allItems.push(item);
    }
  }

  for (let index = 0; index < allItems.length; index += 1) {
    const item = allItems[index];
    const next = allItems[index + 1];
    item.end = next ? next.plannedStart : `${item.plannedStart.slice(0, 16)}:30${item.plannedStart.slice(16)}`;
  }

  trip.items = allItems;

  const legResult = buildLegsForTrip(allItems, raw.summary.transportMode);
  const legs = legResult.legs;
  warnings.push(...legResult.warnings);

  const catchPoints: CatchPoint[] = [];
  for (const leg of legs) {
    const departureItem = allItems.find((item) => item.id === leg.fromItemId) ?? allItems[0];
    catchPoints.push({
      id: `cp-${leg.legId}`,
      type: 'TRANSPORT_DEPARTURE',
      itemId: departureItem.id,
      legId: leg.legId,
      at: leg.plannedDeparture,
      prompt: makePromptForDeparture(leg, departureItem),
    });
  }

  for (const item of allItems) {
    if (!item.fixed || item.kind === 'TRANSPORT') continue;
    if (/(darshan|venkateswara temple)/i.test(`${item.placeName} ${item.description}`)) {
      catchPoints.push({
        id: `cp-fixed-${item.id}`,
        type: 'FIXED_SLOT',
        itemId: item.id,
        at: item.plannedStart,
        prompt: makePromptForFixedSlot(item),
      });
    }
  }

  return { trip, legs, catchPoints, warnings };
}

export class PlanAdapter {
  parse(raw: RawPlan, opts: DemoConfig): ParsedPlan {
    if (!raw || typeof raw !== 'object') {
      return {
        trip: {
          planId: 'unknown',
          planType: 'unknown',
          planName: 'Unknown',
          source: '',
          destination: '',
          durationDays: 1,
          summary: {
            description: '',
            estimatedCost: 0,
            transportMode: 'BUS',
            hotelCategory: '',
            bestFor: '',
          },
          highlights: [],
          items: [],
        },
        legs: [],
        catchPoints: [],
        warnings: ['Input plan was malformed and could not be parsed.'],
      };
    }

    return parseRawPlan(raw, { startDate: opts.startDate ?? '2026-11-20', tz: opts.tz ?? '+05:30' });
  }
}

export const parse = (raw: RawPlan, opts: DemoConfig): ParsedPlan => new PlanAdapter().parse(raw, opts);

export const samplePlanAdapter = () => new PlanAdapter();
