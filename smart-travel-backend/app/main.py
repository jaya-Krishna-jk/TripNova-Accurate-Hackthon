from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.models import (
    TravelRequest,
    PlanDetailsRequest,
    ChatRequest
)

from app.llm import (
    generate_plan_summaries,
    generate_plan_details,
    generate_from_text
)

app = FastAPI(
    title="Smart Travel Experience"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def health():
    return {
        "message": "Smart Travel API Running"
    }


@app.post("/travel/generate-plans")
def generate_plans(request: TravelRequest):

    return generate_plan_summaries(
        request.model_dump()
    )


@app.post("/travel/chat")
def travel_chat(request: ChatRequest):

    return generate_from_text(
        request.message
    )


@app.post("/travel/plan-details")
def plan_details(request: PlanDetailsRequest):

    return generate_plan_details(
        request.model_dump()
    )