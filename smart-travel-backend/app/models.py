from pydantic import BaseModel
from typing import List, Dict, Any


class TravelRequest(BaseModel):
    source: str
    destination: str
    durationDays: int
    travellerCount: int
    travellerType: str
    budget: int
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


class ChatRequest(BaseModel):
    message: str