import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv

load_dotenv()

# --------------------------------------------------
# CONFIG
# --------------------------------------------------
# Only the databaseURL from the Firebase web config is needed by the
# backend. apiKey, authDomain, appId etc. are for the browser SDK.

DATABASE_URL = os.getenv(
    "FIREBASE_DATABASE_URL",
    "https://tripnova-7d0fa-default-rtdb.firebaseio.com"
).rstrip("/")

# Optional: database secret or OAuth access token, needed only if the
# database rules do not allow public reads.
DATABASE_AUTH = os.getenv("FIREBASE_DATABASE_AUTH")

TIMEOUT_SECONDS = 10

CRIMINAL_COLLECTION = "CriminalRecords"
TRIPS_COLLECTION = "userTrips"
LICENSE_FIELDS = ("drivingLicenseNo", "drivingLicenseNumber")


class FirebaseError(Exception):
    """Base error for Firebase access problems."""


class FirebasePermissionError(FirebaseError):
    """Database rules rejected the read."""


class FirebaseUnavailableError(FirebaseError):
    """Could not reach Firebase or got an unexpected response."""


# --------------------------------------------------
# LOW LEVEL REST CALL
# --------------------------------------------------

def _get(path: str, extra_params: Optional[Dict[str, str]] = None):

    params = dict(extra_params or {})

    if DATABASE_AUTH:
        params["auth"] = DATABASE_AUTH

    url = f"{DATABASE_URL}/{path}.json"

    if params:
        url += "?" + urllib.parse.urlencode(params)

    try:
        with urllib.request.urlopen(
            url,
            timeout=TIMEOUT_SECONDS
        ) as response:
            return json.loads(response.read().decode("utf-8")), False

    except urllib.error.HTTPError as exc:

        if exc.code in (401, 403):
            raise FirebasePermissionError(
                "Firebase rules denied read access"
            ) from exc

        if exc.code == 400:
            # e.g. "Index not defined" for orderBy queries
            return None, True

        raise FirebaseUnavailableError(
            f"Firebase returned HTTP {exc.code}"
        ) from exc

    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise FirebaseUnavailableError(
            f"Could not reach Firebase: {exc}"
        ) from exc


def _iter_records(data: Any) -> List[Dict[str, Any]]:
    """
    RTDB returns imported JSON arrays as a list (with possible nulls)
    or as a dict keyed by id. Handle both.
    """

    if not data:
        return []

    if isinstance(data, dict):
        values = data.values()
    else:
        values = data

    return [item for item in values if isinstance(item, dict)]


def _normalize(value: Any) -> str:
    return str(value or "").strip().upper().replace(" ", "")


def _matches(record: Dict[str, Any], license_no: str) -> bool:
    return any(
        _normalize(record.get(field)) == license_no
        for field in LICENSE_FIELDS
    )


# --------------------------------------------------
# PUBLIC API
# --------------------------------------------------

def get_criminal_record_by_license(
    driving_license_no: str
) -> Optional[Dict[str, Any]]:
    """Criminal record for a driving licence number, or None."""

    return _find_by_license(
        CRIMINAL_COLLECTION,
        driving_license_no
    )


def get_trip_by_id(
    trip_id: str
) -> Optional[Dict[str, Any]]:
    """
    Trip stored at userTrips/{tripId}, or None.
    Contains days, tracking, tripId, userId.
    """

    trip_id = (trip_id or "").strip()

    # Firebase keys cannot contain these characters; rejecting them also
    # stops callers from reading other paths in the database.
    if not trip_id or any(ch in trip_id for ch in './$#[]'):
        return None

    data, _ = _get(
        f"{TRIPS_COLLECTION}/{urllib.parse.quote(trip_id, safe='')}"
    )

    if isinstance(data, dict) and data:
        return data

    return None


def _find_by_license(
    collection: str,
    driving_license_no: str
) -> Optional[Dict[str, Any]]:

    license_no = _normalize(driving_license_no)

    if not license_no:
        return None

    # 1) Indexed query (fast). Needs ".indexOn": ["drivingLicenseNo"]
    #    in the database rules, otherwise Firebase answers HTTP 400.
    data, needs_fallback = _get(
        collection,
        {
            "orderBy": '"drivingLicenseNo"',
            "equalTo": f'"{license_no}"'
        }
    )

    if not needs_fallback:
        for record in _iter_records(data):
            if _matches(record, license_no):
                return record

        # Index worked but nothing matched exactly; fall through to a
        # case-insensitive scan in case stored values are not uppercase.

    # 2) Fallback: read the collection and filter in Python.
    #    Fine for a demo-sized dataset.
    data, _ = _get(collection)

    for record in _iter_records(data):
        if _matches(record, license_no):
            return record

    return None
