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

- Delay summary (how far behind the traveller is).
- Current checkpoint (where the traveller is in the plan) with its
  originally planned time and the estimated actual time.
- Checkpoints already visited, with their individual delays.
- The remaining original itinerary (starting from the current
  checkpoint).

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
          "activities": [
            {
              "time": "",
              "place": "",
              "description": ""
            }
          ]
        }
      ]
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

        remaining.append({
            "day": day.get("day"),
            "theme": day.get("theme"),
            "daySummary": day.get("daySummary"),
            "activities": activities
        })

    return remaining


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
        "delay": context["delay"],
        "currentCheckpoint": context["currentCheckpoint"],
        "alternatives": alternatives
    }
