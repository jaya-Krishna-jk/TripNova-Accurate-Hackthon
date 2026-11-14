import json
import os
import re
from datetime import datetime

from dotenv import load_dotenv
from openai import OpenAI

from app.prompts import (
    EXTRACT_TRAVEL_PROMPT,
    VALIDATION_PROMPT,
    PLAN_SUMMARY_PROMPT,
    PLAN_DETAILS_PROMPT
)

load_dotenv()

API_KEY = os.getenv("OPENROUTER_API_KEY")

if not API_KEY:
    raise ValueError(
        "OPENROUTER_API_KEY not found in .env"
    )

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY
)

MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free"


# --------------------------------------------------
# COMMON JSON PARSER
# --------------------------------------------------

def parse_json_response(content: str):

    if not content:
        raise ValueError(
            "AI model returned empty response"
        )

    content = content.strip()

    content = re.sub(
        r"^```(?:json)?\s*",
        "",
        content
    )

    content = re.sub(
        r"\s*```$",
        "",
        content
    )

    try:
        return json.loads(content)

    except json.JSONDecodeError:

        decoder = json.JSONDecoder()

        for index, ch in enumerate(content):

            if ch == "{":

                try:

                    result, _ = decoder.raw_decode(
                        content[index:]
                    )

                    return result

                except json.JSONDecodeError:
                    continue

        raise ValueError(
            f"Invalid JSON returned by model:\n{content}"
        )


# --------------------------------------------------
# COMMON MODEL CALL
# --------------------------------------------------

def call_model(
    system_prompt: str,
    user_prompt: str
):

    response = client.chat.completions.create(
        model=MODEL,
        temperature=0.2,
        max_tokens=16000,
        messages=[
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )

    content = response.choices[0].message.content

    return parse_json_response(content)


# --------------------------------------------------
# VALIDATE USER PROMPT
# --------------------------------------------------

def validate_trip_request(
    user_message: str
):

    extracted = call_model(
        VALIDATION_PROMPT,
        user_message
    )

    required_fields = [
        "source",
        "destination",
        "startDate",
        "endDate",
        "travellerCount",
        "travellerType",
        "budget",
        "mealPreference"
    ]

    if (
        extracted.get("travellerType")
        == "Family"
    ):
        required_fields.extend(
            [
                "childrenCount",
                "seniorCitizenCount"
            ]
        )

    missing_fields = []

    for field in required_fields:

        if (
            field not in extracted
            or extracted[field] is None
        ):
            missing_fields.append(field)

    return {
        "isValid": len(missing_fields) == 0,
        "missingFields": missing_fields,
        "extractedData": extracted
    }


# --------------------------------------------------
# EXTRACT COMPLETE TRIP DATA
# --------------------------------------------------

def extract_trip_request(
    user_message: str
):

    return call_model(
        EXTRACT_TRAVEL_PROMPT,
        user_message
    )


# --------------------------------------------------
# GENERATE PLAN CARDS
# --------------------------------------------------

def generate_plan_summaries(
    request_data: dict
):

    user_prompt = f"""
Source: {request_data["source"]}

Destination: {request_data["destination"]}

Start Date:
{request_data["startDate"]}

End Date:
{request_data["endDate"]}

Duration:
{request_data["durationDays"]} days

Traveller Count:
{request_data["travellerCount"]}

Traveller Type:
{request_data["travellerType"]}

Budget:
{request_data["budget"]}

Meal Preference:
{request_data["mealPreference"]}

Children Count:
{request_data.get("childrenCount", 0)}

Senior Citizen Count:
{request_data.get("seniorCitizenCount", 0)}

Preferences:
{", ".join(request_data["preferences"])}

Hotel Preference:
{request_data["hotelPreference"]}
"""

    return call_model(
        PLAN_SUMMARY_PROMPT,
        user_prompt
    )


# --------------------------------------------------
# GENERATE DAY-WISE ITINERARY
# --------------------------------------------------

def generate_plan_details(
    request_data: dict
):

    user_prompt = f"""
Plan ID:
{request_data["planId"]}

Plan Type:
{request_data["planType"]}

Plan Name:
{request_data["planName"]}

Source:
{request_data["source"]}

Destination:
{request_data["destination"]}

Duration:
{request_data["durationDays"]} days

Summary:
{json.dumps(request_data["summary"], ensure_ascii=False)}

Highlights:
{json.dumps(request_data["highlights"], ensure_ascii=False)}

IMPORTANT

Day 1 should start from source city.

Last day should include return journey.
"""

    return call_model(
        PLAN_DETAILS_PROMPT,
        user_prompt
    )


# --------------------------------------------------
# GENERATE PLANS FROM STRUCTURED DATA
# --------------------------------------------------

def generate_from_text(
    request_data: dict
):

    start_date = datetime.strptime(
        request_data["startDate"],
        "%Y-%m-%d"
    )

    end_date = datetime.strptime(
        request_data["endDate"],
        "%Y-%m-%d"
    )

    request_data["durationDays"] = (
        end_date - start_date
    ).days

    plans = generate_plan_summaries(
        request_data
    )

    return {
        "tripDetails": request_data,
        "plans": plans["plans"]
    }