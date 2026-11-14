from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    ChatRequest,
    TravelRequest,
    PlanDetailsRequest
)

from app.llm import (
    validate_trip_request,
    generate_from_text,
    generate_plan_summaries,
    generate_plan_details
)

app = FastAPI(
    title="Smart Travel Experience",
    description="AI Powered Personalized Travel Planner",
    version="1.0.0"
)

# --------------------------------------------------
# CORS
# --------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --------------------------------------------------
# HEALTH CHECK
# --------------------------------------------------

@app.get("/")
def health():

    return {
        "status": "UP",
        "message": "Smart Travel API Running",
        "model": "NVIDIA Nemotron 3 Ultra"
    }


# --------------------------------------------------
# STEP 1
# VALIDATE PROMPT AND DETECT MISSING FIELDS
# --------------------------------------------------

@app.post("/travel/validate")
def validate(request: ChatRequest):

    return validate_trip_request(
        request.message
    )


# --------------------------------------------------
# STEP 2
# GENERATE PLANS FROM COMPLETE REQUEST DATA
# --------------------------------------------------

@app.post("/travel/chat")
def travel_chat(
    request: TravelRequest
):

    return generate_from_text(
        request.model_dump()
    )


# --------------------------------------------------
# OPTIONAL DIRECT PLAN GENERATION
# --------------------------------------------------

@app.post("/travel/generate-plans")
def generate_plans(
    request: TravelRequest
):

    return generate_plan_summaries(
        request.model_dump()
    )


# --------------------------------------------------
# STEP 3
# GENERATE DETAILED ITINERARY
# --------------------------------------------------

@app.post("/travel/plan-details")
def plan_details(
    request: PlanDetailsRequest
):

    return generate_plan_details(
        request.model_dump()
    )