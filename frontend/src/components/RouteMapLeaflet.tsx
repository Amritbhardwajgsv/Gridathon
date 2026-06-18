"use client";

import "leaflet/dist/leaflet.css";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from "react-leaflet";

import type { RouteResult } from "@/lib/api";

// Fix Leaflet default icon path
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const TARGET_ICON = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
  className: "hue-rotate-[140deg]",   // teal tint for target
});

type Props = {
  officerLat: number;
  officerLng: number;
  targetLat: number;
  targetLng: number;
  targetLabel: string;
  route: RouteResult | null;
};

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (fitted.current || positions.length < 2) return;
    fitted.current = true;
    map.fitBounds(L.latLngBounds(positions), { padding: [32, 32] });
  }, [map, positions]);
  return null;
}

export default function RouteMapLeaflet({
  officerLat,
  officerLng,
  targetLat,
  targetLng,
  targetLabel,
  route,
}: Props) {
  const officerPos: [number, number] = [officerLat, officerLng];
  const targetPos: [number, number] = [targetLat, targetLng];

  // route.coordinates is [lng, lat] from GeoJSON — Leaflet needs [lat, lng]
  const routeLine: [number, number][] =
    route?.coordinates?.map(([lng, lat]) => [lat, lng]) ??
    [officerPos, targetPos];

  return (
    <MapContainer
      center={officerPos}
      className="h-full w-full"
      scrollWheelZoom={false}
      zoom={13}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds positions={[officerPos, targetPos]} />

      {/* Officer position — default blue marker */}
      <Marker position={officerPos}>
        <Popup>
          <strong>Your location</strong>
        </Popup>
      </Marker>

      {/* Complaint / destination — teal marker */}
      <Marker icon={TARGET_ICON} position={targetPos}>
        <Popup>
          <strong>{targetLabel}</strong>
        </Popup>
      </Marker>

      {/* Route line */}
      <Polyline
        color={route?.fallback ? "#707987" : "#e8a034"}
        opacity={0.85}
        positions={routeLine}
        weight={4}
      />
    </MapContainer>
  );
}
