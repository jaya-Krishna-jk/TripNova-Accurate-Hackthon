from pydantic import BaseModel
from typing import List, Dict, Any


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


class ValidationResponse(BaseModel):

    isValid: bool
    missingFields: List[str]
    extractedData: Dict[str, Any]