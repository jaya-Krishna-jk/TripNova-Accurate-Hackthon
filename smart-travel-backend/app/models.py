from pydantic import BaseModel
from typing import List, Dict, Any, Optional


class ChatRequest(BaseModel):
    message: str


class TravelRequest(BaseModel):

    source: str
    destination: str

    startDate: str
    endDate: str

    travellerCount: int
    travellerType: str

    budget: int

    mealPreference: str

    childrenCount: int = 0
    seniorCitizenCount: int = 0

    preferences: List[str]
    hotelPreference: str


class PlanDetailsRequest(BaseModel):

    planId: str
    planType: str
    planName: str

    source: str
    destination: str

    durationDays: int

    summary: Dict[str, Any]

    highlights: List[str]

    # Trip context (travellers, budget, dates, meal preference) used to
    # ground the dossier. Optional so older clients keep working.
    tripDetails: Optional[Dict[str, Any]] = None

    # Already generated day-wise itinerary. When omitted, the backend
    # generates it from the plan before enriching it.
    days: Optional[List[Dict[str, Any]]] = None


class ValidationResponse(BaseModel):

    isValid: bool
    missingFields: List[str]
    extractedData: Dict[str, Any]