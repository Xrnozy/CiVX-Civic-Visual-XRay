"""Reverse geocoding helpers for barangay resolution."""

from __future__ import annotations

import re
import time
from functools import lru_cache

import httpx

from app.config import settings

_BARANGAY_RE = re.compile(r"barangay\s+(.+)", re.IGNORECASE)
_GOOGLE_BARANGAY_TYPES = (
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3",
)
_NOMINATIM_FIELDS = (
    "quarter",
    "suburb",
    "neighbourhood",
    "village",
    "city_district",
    "city",
)


def _normalize_barangay_label(raw: str | None) -> str | None:
    if not raw:
        return None
    text = raw.strip()
    if not text:
        return None
    match = _BARANGAY_RE.search(text)
    if match:
        text = match.group(1).strip()
    if text.lower().startswith("brgy"):
        text = text[4:].strip(" .")
    if text.lower().startswith("barangay"):
        text = text[8:].strip(" .")
    return text or None


def _from_google_components(components: list[dict]) -> str | None:
    for preferred in _GOOGLE_BARANGAY_TYPES:
        for comp in components:
            if preferred in comp.get("types", []):
                label = _normalize_barangay_label(comp.get("long_name"))
                if label:
                    return label
    for comp in components:
        label = _normalize_barangay_label(comp.get("long_name"))
        if label and "barangay" in comp.get("long_name", "").lower():
            return label
    return None


def _from_nominatim_address(address: dict) -> str | None:
    for field in _NOMINATIM_FIELDS:
        label = _normalize_barangay_label(address.get(field))
        if label:
            return label
    display = address.get("display_name", "")
    return _normalize_barangay_label(display.split(",")[0] if display else None)


def _google_reverse(lat: float, lng: float) -> str | None:
    if not settings.google_maps_api_key:
        return None
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={
                    "latlng": f"{lat},{lng}",
                    "key": settings.google_maps_api_key,
                    "language": "en",
                },
            )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        for result in payload.get("results", []):
            label = _from_google_components(result.get("address_components", []))
            if label:
                return label
    except Exception:
        return None
    return None


def _nominatim_reverse(lat: float, lng: float) -> str | None:
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1},
                headers={"User-Agent": "CiVX-Civic-Visual-XRay/1.0 (hackathon demo)"},
            )
        if resp.status_code != 200:
            return None
        payload = resp.json()
        return _from_nominatim_address(payload.get("address", {}))
    except Exception:
        return None


@lru_cache(maxsize=2048)
def reverse_geocode_barangay(lat: float, lng: float) -> str | None:
    """Resolve barangay name from coordinates (cached, rounded to ~100m)."""
    lat_r = round(lat, 3)
    lng_r = round(lng, 3)
    label = _google_reverse(lat_r, lng_r)
    if label:
        return label
    time.sleep(1.05)
    return _nominatim_reverse(lat_r, lng_r)


def resolve_barangay(
    *,
    barangay: str | None = None,
    address_text: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    allow_geocode: bool = True,
) -> str:
    if barangay and barangay.strip():
        return barangay.strip()
    if address_text and address_text.strip():
        return address_text.strip()
    if allow_geocode and latitude is not None and longitude is not None:
        geocoded = reverse_geocode_barangay(latitude, longitude)
        if geocoded:
            return geocoded
    return "Unknown"


def enrich_event_barangay(event: dict, *, persist: bool = False, sb=None) -> dict:
    """Fill missing cleanup-event barangay from coordinates; optionally persist to DB."""
    event = dict(event)
    if (event.get("barangay") or "").strip():
        return event
    lat, lng = event.get("latitude"), event.get("longitude")
    if lat is None or lng is None:
        return event
    resolved = resolve_barangay(latitude=float(lat), longitude=float(lng))
    if resolved == "Unknown":
        return event
    event["barangay"] = resolved
    event_id = event.get("id")
    if persist and event_id and sb is not None:
        try:
            sb.table("cleanup_events").update({"barangay": resolved}).eq("id", event_id).execute()
        except Exception:
            pass
    return event
