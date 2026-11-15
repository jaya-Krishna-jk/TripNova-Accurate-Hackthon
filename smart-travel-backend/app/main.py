from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.firebase_db import (
    get_criminal_record_by_license,
    get_trip_by_id,
    FirebasePermissionError,
    FirebaseUnavailableError
)

from app.replan import (
    STRATEGIES,
    generate_replan_options,
    is_delay_triggered
)

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

# --------------------------------------------------
# DRIVER BACKGROUND VERIFICATION
# FETCH CRIMINAL RECORD BY DRIVING LICENSE NUMBER
# --------------------------------------------------

@app.get("/drivers/{driving_license_no}/criminal-records")
def get_driver_criminal_records(
    driving_license_no: str
):

    try:
        record = get_criminal_record_by_license(
            driving_license_no
        )

    except FirebasePermissionError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Firebase denied access. Check the Realtime "
                "Database rules or FIREBASE_DATABASE_AUTH."
            )
        )

    except FirebaseUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc)
        )

    if record is None:
        raise HTTPException(
            status_code=404,
            detail="No criminal record found for this license number"
        )

    return {
        "drivingLicenseNo": driving_license_no.strip().upper(),
        "isAssured": record.get("verificationStatus") == "CLEAR",
        "record": record
    }


# --------------------------------------------------
# TRIPS
# FETCH TRIP DETAILS BY TRIP ID (userTrips/{tripId})
# --------------------------------------------------

@app.get("/trips/{trip_id}")
def get_trip(
    trip_id: str
):

    try:
        trip = get_trip_by_id(trip_id)

    except FirebasePermissionError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Firebase denied access. Check the Realtime "
                "Database rules or FIREBASE_DATABASE_AUTH."
            )
        )

    except FirebaseUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc)
        )

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    return trip


# --------------------------------------------------
# TRIPS
# RE-ITINERARY OPTIONS WHEN TRAVELLER IS RUNNING LATE
# --------------------------------------------------

@app.post("/trips/{trip_id}/replan")
def replan_trip(
    trip_id: str,
    force: bool = False,
    option: Optional[str] = None,
    refresh: bool = False
):
    """
    option:  generate only some options, e.g. ?option=1 or ?option=1,3.
             The UI can call ?option=1, ?option=2 and ?option=3 at the
             same time and show each one as soon as it arrives.
    refresh: ignore cached results and generate again.
    """

    option_ids = None

    if option:
        option_ids = [o.strip() for o in option.split(",") if o.strip()]
        unknown = [o for o in option_ids if o not in STRATEGIES]

        if unknown:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Unknown option(s) {unknown}. "
                    f"Valid options: {list(STRATEGIES)}"
                )
            )

    try:
        trip = get_trip_by_id(trip_id)

    except FirebasePermissionError:
        raise HTTPException(
            status_code=502,
            detail=(
                "Firebase denied access. Check the Realtime "
                "Database rules or FIREBASE_DATABASE_AUTH."
            )
        )

    except FirebaseUnavailableError as exc:
        raise HTTPException(
            status_code=503,
            detail=str(exc)
        )

    if trip is None:
        raise HTTPException(
            status_code=404,
            detail="Trip not found"
        )

    # Only re-plan when tracking says the delay threshold is crossed.
    # Pass ?force=true to generate options anyway (useful for demos).
    if not force and not is_delay_triggered(trip):
        raise HTTPException(
            status_code=409,
            detail=(
                "Traveller is not delayed beyond the threshold. "
                "Use ?force=true to generate options anyway."
            )
        )

    try:
        return generate_replan_options(
            trip,
            option_ids=option_ids,
            refresh=refresh
        )

    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"AI model error: {exc}"
        )