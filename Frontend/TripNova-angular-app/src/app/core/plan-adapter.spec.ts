import { describe, expect, it } from 'vitest';
import { PlanAdapter } from './plan-adapter';
import type { RawPlan } from './plan-types';

const samplePlan: RawPlan = {
  planId: '1',
  planType: 'Trip',
  planName: 'Hyderabad to Thirupathi',
  source: 'Hyderabad',
  destination: 'Thirupathi',
  durationDays: 3,
  summary: {
    description: 'Hyderabad to Thirupathi',
    estimatedCost: 2500,
    transportMode: 'Public Bus',
    hotelCategory: 'Budget Hotel',
    bestFor: 'Pilgrimage',
  },
  highlights: ['Temple visit'],
  days: [
    {
      day: 1,
      theme: 'Travel',
      daySummary: 'Leave Hyderabad and arrive in Thirupathi',
      activities: [
        { time: '06:00 AM', place: 'Hyderabad Bus Station', description: 'depart Hyderabad Bus Station' },
        { time: '02:00 PM', place: 'Enroute', description: 'lunch enroute' },
        { time: '04:00 PM', place: 'Thirupathi Bus Station', description: 'arrive in Thirupathi Bus Station' },
        { time: '04:30 PM', place: 'Budget Hotel', description: 'hotel check-in' },
        { time: '05:30 PM', place: 'TTD Gardens', description: 'visit TTD Gardens' },
        { time: '07:30 PM', place: 'Local Market', description: 'dinner' },
        { time: '09:00 PM', place: 'Budget Hotel', description: 'back at hotel' },
      ],
    },
    {
      day: 2,
      theme: 'Pilgrimage',
      daySummary: 'Temple day',
      activities: [
        { time: '06:00 AM', place: 'Sri Venkateswara Temple', description: 'darshan at Sri Venkateswara Temple' },
        { time: '10:00 AM', place: 'Temple Canteen', description: 'breakfast' },
        { time: '11:00 AM', place: 'Sri Padmavathi Ammavari Temple', description: 'visit Sri Padmavathi Ammavari Temple' },
        { time: '01:00 PM', place: 'Lunch Spot', description: 'lunch' },
        { time: '02:30 PM', place: 'Akasa Ganga', description: 'visit Akasa Ganga' },
        { time: '04:30 PM', place: 'Budget Hotel', description: 'return to the hotel' },
        { time: '07:00 PM', place: 'Local Market', description: 'local market' },
        { time: '08:30 PM', place: 'Restaurant', description: 'dinner' },
        { time: '10:00 PM', place: 'Budget Hotel', description: 'hotel' },
      ],
    },
    {
      day: 3,
      theme: 'Return',
      daySummary: 'Return to Hyderabad',
      activities: [
        { time: '07:00 AM', place: 'Budget Hotel', description: 'check-out' },
        { time: '08:00 AM', place: 'Cafeteria', description: 'breakfast' },
        { time: '09:00 AM', place: 'Silathoranam', description: 'visit Silathoranam' },
        { time: '11:00 AM', place: 'Thirupathi Bus Station', description: 'depart Thirupathi Bus Station' },
        { time: '11:30 AM', place: 'Lunch Stop', description: 'lunch enroute' },
        { time: '07:30 PM', place: 'Hyderabad Bus Station', description: 'arrive in Hyderabad Bus Station' },
      ],
    },
  ],
};

describe('PlanAdapter', () => {
  it('parses the sample plan into itinerary items and legs', () => {
    const parsed = new PlanAdapter().parse(samplePlan, { startDate: '2026-11-20', tz: '+05:30' });

    expect(parsed.trip.items.length).toBeGreaterThan(0);
    expect(parsed.trip.planName).toBe('Hyderabad to Thirupathi');
    expect(parsed.legs).toHaveLength(2);
    expect(parsed.catchPoints.map((point) => point.type)).toEqual([
      'TRANSPORT_DEPARTURE',
      'TRANSPORT_DEPARTURE',
      'FIXED_SLOT',
    ]);
    expect(parsed.legs[0].mode).toBe('BUS');
    expect(parsed.legs[0].plannedDeparture).toContain('2026-11-20T06:00:00');
    expect(parsed.legs[1].plannedDeparture).toContain('2026-11-22T11:00:00');
  });

  it('detects illegal time rollover and adds warnings', () => {
    const rawPlan: RawPlan = {
      ...samplePlan,
      days: [
        {
          day: 1,
          theme: 'Travel',
          daySummary: 'Travel',
          activities: [
            { time: '11:00 AM', place: 'A', description: 'depart A' },
            { time: '10:00 AM', place: 'B', description: 'arrive in B' },
          ],
        },
      ],
    };

    const parsed = new PlanAdapter().parse(rawPlan, { startDate: '2026-11-20', tz: '+05:30' });
    expect(parsed.warnings.some((warning) => warning.toLowerCase().includes('rollover'))).toBe(true);
  });
});
