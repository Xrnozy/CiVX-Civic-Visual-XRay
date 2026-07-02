"""Reverse geocoding helpers for barangay and full address resolution."""

from __future__ import annotations

import json
import re
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, dataclass
from functools import lru_cache
from pathlib import Path

import httpx

from app.config import settings
from app.utils.supabase_schema import update_row

_BARANGAY_RE = re.compile(r"barangay\s+(.+)", re.IGNORECASE)
_GOOGLE_BARANGAY_TYPES = (
    "sublocality_level_1",
    "sublocality",
    "neighborhood",
    "administrative_area_level_3",
)
_NOMINATIM_BARANGAY_FIELDS = (
    "quarter",
    "suburb",
    "neighbourhood",
    "village",
    "city_district",
    "city",
)
_DEBUG_LOG_PATH = Path(__file__).resolve().parents[3] / "debug-8b92e3.log"


@dataclass(frozen=True)
class ResolvedAddress:
    barangay: str | None = None
    street: str | None = None
    city: str | None = None
    province: str | None = None

    def to_api_dict(self) -> dict[str, str | None]:
        return {
            "barangay": self.barangay,
            "street": self.street,
            "city": self.city,
            "province": self.province,
        }


def _clean(value: str | None) -> str | None:
    if not value:
        return None
    text = value.strip()
    return text or None


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


def _pick_google_component(components: list[dict], *preferred_types: str) -> str | None:
    for preferred in preferred_types:
        for comp in components:
            if preferred in comp.get("types", []):
                label = _clean(comp.get("long_name"))
                if label:
                    return label
    return None


def _street_from_google_results(results: list[dict], lat: float, lng: float) -> str | None:
    """Pick the route whose geometry is closest to the pin (not a nearby address)."""
    candidates: list[tuple[int, float, str]] = []
    for result in results:
        components = result.get("address_components", [])
        route = _pick_google_component(components, "route")
        if not route:
            continue
        location = result.get("geometry", {}).get("location", {})
        result_lat = location.get("lat")
        result_lng = location.get("lng")
        if result_lat is None or result_lng is None:
            continue
        types = set(result.get("types", []))
        if types == {"route"}:
            priority = 4
        elif "route" in types and "street_address" not in types and "premise" not in types:
            priority = 3
        elif "route" in types and "street_address" in types:
            priority = 1
        else:
            priority = 2
        distance_sq = (float(result_lat) - lat) ** 2 + (float(result_lng) - lng) ** 2
        candidates.append((priority, -distance_sq, route))

    if not candidates:
        return None
    candidates.sort(reverse=True)
    return candidates[0][2]


def _agent_log(message: str, data: dict, hypothesis_id: str) -> None:
    # #region agent log
    try:
        payload = {
            "sessionId": "8b92e3",
            "location": "geocoding.py:reverse_geocode_address",
            "message": message,
            "data": data,
            "timestamp": int(time.time() * 1000),
            "hypothesisId": hypothesis_id,
            "runId": "street-fix",
        }
        with _DEBUG_LOG_PATH.open("a", encoding="utf-8") as fh:
            fh.write(json.dumps(payload) + "\n")
    except Exception:
        pass
    # #endregion


def _barangay_from_google_components(components: list[dict]) -> str | None:
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


def _barangay_from_nominatim_address(address: dict) -> str | None:
    for field in _NOMINATIM_BARANGAY_FIELDS:
        label = _normalize_barangay_label(address.get(field))
        if label:
            return label
    display = address.get("display_name", "")
    return _normalize_barangay_label(display.split(",")[0] if display else None)


def _google_resolve_address(lat: float, lng: float) -> ResolvedAddress | None:
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
        results = payload.get("results", [])
        if not results:
            return None

        street = _street_from_google_results(results, lat, lng)
        barangay = city = province = None
        for result in results:
            components = result.get("address_components", [])
            barangay = barangay or _barangay_from_google_components(components)
            city = city or _pick_google_component(
                components,
                "locality",
                "administrative_area_level_3",
                "administrative_area_level_2",
            )
            province = province or _pick_google_component(
                components,
                "administrative_area_level_1",
                "administrative_area_level_2",
            )
            if barangay and city and province and street:
                break

        if barangay or street or city or province:
            return ResolvedAddress(
                barangay=barangay,
                street=street,
                city=city,
                province=province,
            )
    except Exception:
        return None
    return None


def _nominatim_resolve_address(lat: float, lng: float) -> ResolvedAddress | None:
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={"lat": lat, "lon": lng, "format": "json", "addressdetails": 1},
                headers={"User-Agent": "CiVX-Civic-Visual-XRay/1.0 (hackathon demo)"},
            )
        if resp.status_code != 200:
            return None
        address = resp.json().get("address", {})
        if not address:
            return None
        return ResolvedAddress(
            barangay=_barangay_from_nominatim_address(address),
            street=_clean(address.get("road") or address.get("pedestrian") or address.get("footway")),
            city=_clean(
                address.get("city")
                or address.get("town")
                or address.get("municipality")
                or address.get("city_district")
            ),
            province=_clean(address.get("state") or address.get("region") or address.get("state_district")),
        )
    except Exception:
        return None


_GEOCODE_PRECISION = 5  # ~1.1 m — 3 decimals (~111 m) mis-assigns nearby parallel streets


@lru_cache(maxsize=2048)
def reverse_geocode_address(lat: float, lng: float) -> ResolvedAddress:
    """Resolve barangay + street/city/province from coordinates (cached, rounded to ~1 m)."""
    lat_r = round(lat, _GEOCODE_PRECISION)
    lng_r = round(lng, _GEOCODE_PRECISION)

    def nominatim_lookup() -> ResolvedAddress | None:
        time.sleep(1.05)
        return _nominatim_resolve_address(lat_r, lng_r)

    with ThreadPoolExecutor(max_workers=2) as pool:
        google_future = pool.submit(_google_resolve_address, lat_r, lng_r)
        nominatim_future = pool.submit(nominatim_lookup)
        google = google_future.result()
        nominatim = nominatim_future.result()

    street = None
    street_source = None
    if nominatim and nominatim.street:
        street = nominatim.street
        street_source = "nominatim"
    elif google and google.street:
        street = google.street
        street_source = "google"

    if google or nominatim:
        resolved = ResolvedAddress(
            barangay=(google.barangay if google else None) or (nominatim.barangay if nominatim else None),
            street=street,
            city=(google.city if google else None) or (nominatim.city if nominatim else None),
            province=(google.province if google else None) or (nominatim.province if nominatim else None),
        )
        _agent_log(
            "resolved address",
            {
                "lat": lat_r,
                "lng": lng_r,
                "street": resolved.street,
                "street_source": street_source,
                "google_street": google.street if google else None,
                "nominatim_street": nominatim.street if nominatim else None,
            },
            "H-street-mismatch",
        )
        return resolved

    return ResolvedAddress()


@lru_cache(maxsize=2048)
def reverse_geocode_barangay(lat: float, lng: float) -> str | None:
    return reverse_geocode_address(lat, lng).barangay


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


def resolve_address_fields(
    *,
    barangay: str | None = None,
    street: str | None = None,
    city: str | None = None,
    province: str | None = None,
    latitude: float | None = None,
    longitude: float | None = None,
    allow_geocode: bool = True,
) -> ResolvedAddress:
    manual = ResolvedAddress(
        barangay=_clean(barangay),
        street=_clean(street),
        city=_clean(city),
        province=_clean(province),
    )
    if manual.barangay and manual.street and manual.city and manual.province:
        return manual
    if not allow_geocode or latitude is None or longitude is None:
        return manual
    geocoded = reverse_geocode_address(latitude, longitude)
    return ResolvedAddress(
        barangay=manual.barangay or geocoded.barangay,
        street=manual.street or geocoded.street,
        city=manual.city or geocoded.city,
        province=manual.province or geocoded.province,
    )


def enrich_event_barangay(event: dict, *, persist: bool = False, sb=None) -> dict:
    """Fill missing cleanup-event address fields from coordinates; optionally persist."""
    event = dict(event)
    if (event.get("barangay") or "").strip():
        return event
    lat, lng = event.get("latitude"), event.get("longitude")
    if lat is None or lng is None:
        return event
    resolved = resolve_address_fields(
        barangay=event.get("barangay"),
        street=event.get("street"),
        city=event.get("city"),
        province=event.get("province"),
        latitude=float(lat),
        longitude=float(lng),
    )
    if not resolved.barangay:
        return event
    event["barangay"] = resolved.barangay
    event["street"] = resolved.street or event.get("street")
    event["city"] = resolved.city or event.get("city")
    event["province"] = resolved.province or event.get("province")
    event_id = event.get("id")
    if persist and event_id and sb is not None:
        try:
            update_row(
                sb,
                "cleanup_events",
                {
                    "barangay": resolved.barangay,
                    "street": resolved.street,
                    "city": resolved.city,
                    "province": resolved.province,
                },
                id=event_id,
            )
        except Exception:
            try:
                update_row(sb, "cleanup_events", {"barangay": resolved.barangay}, id=event_id)
            except Exception:
                pass
    return event


def resolved_address_as_dict(resolved: ResolvedAddress) -> dict[str, str | None]:
    return asdict(resolved)
