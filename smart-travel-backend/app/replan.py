import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

IST = timezone(timedelta(hours=5, minutes=30))

NUMBER_OF_ALTERNATIVES = 3


# --------------------------------------------------
# PROMPT
# --------------------------------------------------

REPLAN_PROMPT = """
You are an enterprise-grade AI travel re-planning engine.

A traveller is on a trip that was planned day by day. Live tracking
shows the traveller has fallen significantly behind schedule.
Your job is to create ALTERNATIVE re-itineraries for the REMAINING
part of the trip so the traveller can choose what works for them.

INPUT YOU WILL RECEIVE:

- Trip profile (source, destination, travel mode, traveller count,
  budget, meal and hotel preferences).
- Delay summary (how far behind the traveller is).
- Current checkpoint (where the traveller is in the plan) with its
  originally planned time and the estimated actual time.
- Checkpoints already visited, with their individual delays.
- The remaining original itinerary (starting from the current
  checkpoint), including any transport, dining, accommodation and
  cost details that were planned.

OUTPUT FORMAT:

Return ONLY valid JSON.

{
  "alternatives": [
    {
      "optionId": "1",
      "optionName": "",
      "strategy": "",
      "description": "",
      "impact": {
        "keptPlaces": [],
        "skippedPlaces": [],
        "returnTimeChange": "",
        "tradeOffs": ""
      },
      "days": [
        {
          "day": 1,
          "theme": "",
          "daySummary": "",
          "estimatedCost": null,
          "activities": [
            {
              "time": "",
              "place": "",
              "type": "",
              "description": "",
              "duration": null,
              "estimatedCost": null,
              "bookingStatus": "NOT_BOOKED"
            }
          ],
          "transport": {
            "mode": "",
            "description": "",
            "estimatedDuration": null,
            "estimatedCost": null
          },
          "dining": [
            {
              "meal": "",
              "restaurant": "",
              "cuisine": "",
              "recommendedDishes": [],
              "estimatedCost": null
            }
          ],
          "accommodation": {
            "name": null,
            "category": null,
            "estimatedCost": null,
            "bookingStatus": "NOT_BOOKED"
          },
          "conciergeNote": "",
          "precautions": []
        }
      ],
      "routeOverview": {
        "totalDistance": null,
        "estimatedDuration": null,
        "stops": [],
        "description": ""
      },
      "budgetBreakdown": {
        "total": null,
        "perPerson": null,
        "categories": [
          {
            "name": "",
            "amount": null
          }
        ],
        "savings": []
      },
      "travelTips": [
        {
          "category": "",
          "title": "",
          "description": "",
          "severity": "INFO"
        }
      ],
      "weatherAndPacking": {
        "forecastAvailable": false,
        "temperature": null,
        "conditions": null,
        "packingEssentials": []
      }
    }
  ]
}

ALTERNATIVE STRATEGIES:

Generate EXACTLY 3 alternatives, one for each strategy:

1. COMPRESSED PLAN
   - Keep as many original places as possible.
   - Tighten timings and cut idle or low-value time.
   - Aim to keep the original return journey time.

2. HIGHLIGHTS ONLY
   - Keep only the must-see places and drop the lower priority ones.
   - Relaxed pace with enough buffer time.
   - Aim to keep the original return journey time.

3. SHIFTED SCHEDULE
   - Keep the plan largely as designed but shift it by the delay.
   - Clearly state if the return journey time changes and that
     the traveller may need to rebook return transport.

RULES:

1. Plan ONLY the remaining trip, starting from the current
   checkpoint at the ESTIMATED actual time (not the originally
   planned time).
2. Day numbers must match the original trip day numbers.
3. Never schedule activities in the past of the estimated time.
4. Use realistic timings and account for travel time between places.
5. The trip must still end at the original source city with the
   return journey included.
6. Do not invent confirmed hotel bookings, transport bookings or
   ticket availability.
7. Do not add places that are far from the destination.
8. Every day must have a theme, daySummary and at least 3 activities.
9. Every activity must have time, place and description.
10. impact.keptPlaces and impact.skippedPlaces must be arrays of
    place names compared with the remaining original itinerary.
11. Plans must be meaningfully different from each other.

DETAIL RULES (apply to EVERY alternative):

12. Every activity must also have a type (for example Sightseeing,
    Temple, Meal, Travel, Rest, Shopping), a duration and a
    bookingStatus. Use "NOT_BOOKED" unless the original itinerary
    shows a different status for that same place.
13. Every day must include transport (how the traveller moves around
    that day), dining (the meals that still fit in that day),
    accommodation (use null name and category on a day with no
    overnight stay), a short conciergeNote and precautions.
14. Reuse the transport, dining, accommodation and cost details from
    the remaining original itinerary wherever the same place or meal
    is kept. Only estimate what is missing.
15. All costs are numbers in INR for the whole travelling group, with
    no currency symbol. Use null when a cost cannot be estimated.
16. day.estimatedCost is the sum of that day's costs.
    budgetBreakdown.total is the cost of the REMAINING trip under
    this alternative, split into categories such as Transport, Stay,
    Food, Activities and Miscellaneous. perPerson is total divided by
    the traveller count.
17. budgetBreakdown.savings lists short notes on money saved or extra
    money needed compared with the original plan (for example a
    skipped paid visit, or a rebooking fee for a later return).
18. routeOverview.stops is the ordered list of place names for the
    remaining trip under this alternative.
19. travelTips must contain 2 to 4 tips relevant to travelling late
    (rebooking, closing times, night travel safety, informing the
    hotel). severity is INFO, WARNING or CRITICAL.
20. weatherAndPacking: forecastAvailable must be false. Give seasonal
    guidance for the destination and 3 to 5 packingEssentials.
21. Keep every description to one or two short sentences so the
    whole response stays compact.

JSON RULES:

- Return only valid JSON.
- Do not return Markdown.
- Do not include explanations.
- Do not include text outside the JSON object.
"""


# --------------------------------------------------
# HELPERS
# --------------------------------------------------

def _format_ms(epoch_ms: Optional[int]) -> Optional[str]:

    if not epoch_ms:
        return None

    return datetime.fromtimestamp(
        epoch_ms / 1000,
        IST
    ).strftime("%d %b %Y, %I:%M %p IST")


def _shift_time(time_str: str, hours: float) -> Optional[str]:
    """'06:00 AM' + 9h -> '03:00 PM'; adds '(+1 day)' if it wraps."""

    try:
        base = datetime.strptime(time_str.strip(), "%I:%M %p")
    except (ValueError, AttributeError):
        return None

    shifted = base + timedelta(hours=hours)
    days_later = (shifted.date() - base.date()).days
    label = shifted.strftime("%I:%M %p")

    return f"{label} (+{days_later} day)" if days_later else label


def is_delay_triggered(trip: Dict[str, Any]) -> bool:

    tracking = trip.get("tracking") or {}

    if tracking.get("delayTriggered") is True:
        return True

    drift = tracking.get("driftHrs") or 0
    threshold = tracking.get("delayThresholdHrs") or 5

    return drift >= threshold


def _remaining_itinerary(
    trip: Dict[str, Any],
    day_index: int,
    checkpoint_index: int
) -> List[Dict[str, Any]]:

    days = trip.get("days") or []
    remaining = []

    for i, day in enumerate(days):

        if i < day_index:
            continue

        activities = day.get("activities") or []

        if i == day_index:
            activities = activities[checkpoint_index:]

        entry = {
            "day": day.get("day"),
            "theme": day.get("theme"),
            "daySummary": day.get("daySummary"),
            "activities": activities
        }

        # Carry the planned details so the model can reuse them
        # instead of inventing new ones.
        for key in _DAY_DETAIL_KEYS:
            if day.get(key) is not None:
                entry[key] = day[key]

        remaining.append(entry)

    return remaining


_DAY_DETAIL_KEYS = (
    "estimatedCost",
    "transport",
    "dining",
    "accommodation"
)


def _trip_profile(trip: Dict[str, Any]) -> Dict[str, Any]:
    """Who is travelling and on what budget, for grounding costs."""

    overview = trip.get("overview") or {}
    details = trip.get("tripDetails") or {}

    return {
        "planName": trip.get("planName"),
        "source": overview.get("source") or details.get("source"),
        "destination": (
            overview.get("destination") or details.get("destination")
        ),
        "travelMode": overview.get("travelMode"),
        "travelerCount": (
            overview.get("travelerCount")
            or details.get("travellerCount")
        ),
        "budget": details.get("budget"),
        "mealPreference": details.get("mealPreference"),
        "hotelPreference": details.get("hotelPreference")
    }


# --------------------------------------------------
# BUILD CONTEXT FOR THE LLM
# --------------------------------------------------

def build_replan_context(trip: Dict[str, Any]) -> Dict[str, Any]:

    tracking = trip.get("tracking") or {}
    current = tracking.get("currentCheckpoint") or {}

    drift = tracking.get("driftHrs") or 0
    day_index = current.get("dayIndex") or 0
    cp_index = current.get("dayCheckpointIndex") or 0

    planned_time = None
    days = trip.get("days") or []

    try:
        planned_time = days[day_index]["activities"][cp_index]["time"]
    except (IndexError, KeyError, TypeError):
        pass

    estimated_time = (
        _shift_time(planned_time, drift) if planned_time else None
    )

    visited = [
        {
            "day": s.get("dayNumber"),
            "checkpoint": s.get("checkpointName"),
            "delayHrs": s.get("delayHrs", 0),
            "outcome": s.get("outcome")
        }
        for s in tracking.get("checkpointStates") or []
        if s.get("status") == "visited"
    ]

    return {
        "tripId": trip.get("tripId"),
        "trip": _trip_profile(trip),
        "delay": {
            "totalDelayHrs": drift,
            "thresholdHrs": tracking.get("delayThresholdHrs"),
            "delayTriggered": tracking.get("delayTriggered"),
            "lastTrackingUpdate": _format_ms(
                (tracking.get("lastEvent") or {}).get("occurredAt")
            )
        },
        "currentCheckpoint": {
            "name": current.get("checkpointName"),
            "dayNumber": current.get("dayNumber"),
            "originallyPlannedTime": planned_time,
            "estimatedActualTime": estimated_time
        },
        "visitedCheckpoints": visited,
        "remainingOriginalItinerary": _remaining_itinerary(
            trip, day_index, cp_index
        )
    }


def build_replan_user_prompt(context: Dict[str, Any]) -> str:

    delay = context["delay"]
    cp = context["currentCheckpoint"]

    return f"""
CONTEXT:

The traveller has MISSED the planned schedule and is running
{delay["totalDelayHrs"]} hours behind
(alert threshold: {delay["thresholdHrs"]} hours).

The traveller is currently at checkpoint "{cp["name"]}"
on Day {cp["dayNumber"]}.
Originally planned time: {cp["originallyPlannedTime"]}.
Estimated actual time now: {cp["estimatedActualTime"]}.

Based on the trip details and live tracking details below, provide
{NUMBER_OF_ALTERNATIVES} alternative re-itinerary options.

TRIP AND TRACKING DETAILS (JSON):

{json.dumps(context, ensure_ascii=False, indent=2)}
"""


# --------------------------------------------------
# PUBLIC FUNCTION
# --------------------------------------------------

def generate_replan_options(trip: Dict[str, Any]) -> Dict[str, Any]:

    # imported here so this module can be tested without LLM settings
    from app.llm import call_model

    context = build_replan_context(trip)

    result = call_model(
        REPLAN_PROMPT,
        build_replan_user_prompt(context)
    )

    alternatives = result.get("alternatives")

    if not isinstance(alternatives, list) or not alternatives:
        raise ValueError(
            "AI model did not return any alternatives"
        )

    return {
        "tripId": trip.get("tripId"),
        "userId": trip.get("userId"),
        "trip": context["trip"],
        "delay": context["delay"],
        "currentCheckpoint": context["currentCheckpoint"],
        "alternatives": alternatives
    }
