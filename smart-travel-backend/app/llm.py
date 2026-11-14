import json
import os

from dotenv import load_dotenv
from openai import OpenAI

from app.prompts import (
    EXTRACT_TRAVEL_PROMPT,
    PLAN_SUMMARY_PROMPT,
    PLAN_DETAILS_PROMPT
)

load_dotenv()

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=os.getenv("OPENROUTER_API_KEY")
)

MODEL = "deepseek/deepseek-chat"


def extract_trip_request(user_message: str):

    response = client.chat.completions.create(
        model=MODEL,
        response_format={
            "type": "json_object"
        },
        messages=[
            {
                "role": "system",
                "content": EXTRACT_TRAVEL_PROMPT
            },
            {
                "role": "user",
                "content": user_message
            }
        ]
    )

    return json.loads(
        response.choices[0].message.content
    )


def generate_plan_summaries(request_data):

    user_prompt = f"""
Source: {request_data['source']}

Destination: {request_data['destination']}

Duration: {request_data['durationDays']} days

Traveller Count: {request_data['travellerCount']}

Traveller Type: {request_data['travellerType']}

Budget: {request_data['budget']}

Preferences:
{", ".join(request_data['preferences'])}

Hotel Preference:
{request_data['hotelPreference']}
"""

    response = client.chat.completions.create(
        model=MODEL,
        response_format={
            "type": "json_object"
        },
        messages=[
            {
                "role": "system",
                "content": PLAN_SUMMARY_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )

    return json.loads(
        response.choices[0].message.content
    )


def generate_plan_details(request_data):

    user_prompt = f"""
Plan ID:
{request_data['planId']}

Plan Type:
{request_data['planType']}

Plan Name:
{request_data['planName']}

Source:
{request_data['source']}

Destination:
{request_data['destination']}

Duration:
{request_data['durationDays']} days

Summary:
{json.dumps(request_data['summary'])}

Highlights:
{", ".join(request_data['highlights'])}
"""

    response = client.chat.completions.create(
        model=MODEL,
        response_format={
            "type": "json_object"
        },
        messages=[
            {
                "role": "system",
                "content": PLAN_DETAILS_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )

    return json.loads(
        response.choices[0].message.content
    )

    user_prompt = f"""
Plan ID:
{request_data['planId']}

Plan Type:
{request_data['planType']}

Plan Name:
{request_data['planName']}

Summary:
{json.dumps(request_data['summary'])}

Highlights:
{", ".join(request_data['highlights'])}
"""

    response = client.chat.completions.create(
        model=MODEL,
        response_format={
            "type": "json_object"
        },
        messages=[
            {
                "role": "system",
                "content": PLAN_DETAILS_PROMPT
            },
            {
                "role": "user",
                "content": user_prompt
            }
        ]
    )

    return json.loads(
        response.choices[0].message.content
    )


def generate_from_text(user_message: str):

    extracted_request = extract_trip_request(
        user_message
    )

    plans = generate_plan_summaries(
        extracted_request
    )

    return {
        "extractedRequest": extracted_request,
        "plans": plans["plans"]
    }