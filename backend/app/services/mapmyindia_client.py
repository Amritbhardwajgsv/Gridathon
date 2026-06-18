from dataclasses import dataclass
from typing import Any

import requests

from app.core.config import get_mapmyindia_api_key, get_mapmyindia_geocode_url


@dataclass
class GeocodeResult:
    latitude: float
    longitude: float
    confidence: float | None
    raw: dict[str, Any]


class MapMyIndiaClient:
    def __init__(self) -> None:
        self.api_key = get_mapmyindia_api_key()
        self.geocode_url = get_mapmyindia_geocode_url()

    @property
    def is_enabled(self) -> bool:
        return bool(self.api_key and self.geocode_url)

    def geocode(self, query: str) -> GeocodeResult | None:
        if not self.is_enabled:
            return None

        try:
            response = requests.get(
                self.geocode_url,
                params={"address": query},
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Accept": "application/json",
                },
                timeout=5,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            return None

        point = self._extract_point(payload)
        if not point:
            return None

        latitude, longitude, confidence = point
        return GeocodeResult(
            latitude=latitude,
            longitude=longitude,
            confidence=confidence,
            raw=payload,
        )

    @staticmethod
    def _extract_point(payload: dict[str, Any]) -> tuple[float, float, float | None] | None:
        candidates = []
        if isinstance(payload.get("copResults"), dict):
            candidates.append(payload["copResults"])
        if isinstance(payload.get("results"), list):
            candidates.extend(payload["results"])
        if isinstance(payload.get("suggestedLocations"), list):
            candidates.extend(payload["suggestedLocations"])

        for candidate in candidates:
            lat = (
                candidate.get("latitude")
                or candidate.get("lat")
                or candidate.get("y")
            )
            lng = (
                candidate.get("longitude")
                or candidate.get("lng")
                or candidate.get("lon")
                or candidate.get("x")
            )
            if lat is None or lng is None:
                continue

            confidence = candidate.get("confidence") or candidate.get("score")
            return float(lat), float(lng), float(confidence) if confidence else None

        return None


mapmyindia_client = MapMyIndiaClient()
