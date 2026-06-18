"use client";

import { AlertTriangle, Clock, MapPinned, Navigation, Package } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";

import ChatPanel from "@/components/ChatPanel";
import { getFieldRoute, listPersonnel } from "@/lib/api";
import type { RouteResult } from "@/lib/api";
import { enrouteCarryItems, complaintTypeLabels } from "@/lib/bengaluru";
import { haversineKm, haversineMeters } from "@/lib/distance";
import type { PolicePersonnel } from "@/types/prediction";

const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY ?? "";

// ── Constants ───────────────────────────────────────────────────────────────

const BLR_LAT = 12.9716;
const BLR_LNG = 77.5946;
const ARRIVAL_THRESHOLD_M = 100;
const NEARBY_OFFICER_KM   = 10;

type Props = {
  officerLat: number | null;
  officerLng: number | null;
  targetLat: number | null;
  targetLng: number | null;
  targetLabel: string;
  complaintType: string;
  deploymentId: string;
  myName: string;
  myRole: string;
};

// ── Lazy-load the map (both need browser) ───────────────────────────────────

const MapplsMap = dynamic(() => import("@/components/MapplsRouteMap"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[12px] text-[#707987]">
      Loading Mappls map…
    </div>
  ),
});

const LeafletMap = dynamic(() => import("@/components/RouteMapLeaflet"), {
  ssr: false,
  loading: () => (
    <div className="grid h-full place-items-center text-[12px] text-[#707987]">
      Loading map…
    </div>
  ),
});

// ── Main component ──────────────────────────────────────────────────────────

export default function EnrouteMapPanel({
  officerLat,
  officerLng,
  targetLat,
  targetLng,
  targetLabel,
  complaintType,
  deploymentId,
  myName,
  myRole,
}: Props) {
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeError, setRouteError] = useState(false);
  const [nearbyOfficers, setNearbyOfficers] = useState<PolicePersonnel[]>([]);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Only fetch route for the Leaflet fallback (Mappls handles routing internally)
    if (MAPPLS_KEY) return;
    if (fetchedRef.current) return;
    if (!targetLat || !targetLng) return;
    fetchedRef.current = true;

    getFieldRoute(officerLat ?? targetLat ?? BLR_LAT, officerLng ?? targetLng ?? BLR_LNG, targetLat, targetLng)
      .then(setRoute)
      .catch(() => setRouteError(true));
  }, [officerLat, officerLng, targetLat, targetLng]);

  // Fetch nearby officers once on mount
  useEffect(() => {
    listPersonnel()
      .then((all) => {
        const centre = { lat: targetLat ?? BLR_LAT, lng: targetLng ?? BLR_LNG };
        const nearby = all.filter((p) => {
          if (!p.current_latitude || !p.current_longitude) return false;
          return haversineKm(centre.lat, centre.lng, p.current_latitude, p.current_longitude) <= NEARBY_OFFICER_KM;
        });
        setNearbyOfficers(nearby);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const carryItems = enrouteCarryItems[complaintType] ?? enrouteCarryItems.other;
  const fromLat = officerLat ?? targetLat ?? BLR_LAT;
  const fromLng = officerLng ?? targetLng ?? BLR_LNG;
  const hasOfficerGPS = officerLat !== null && officerLng !== null;

  // Distance from officer to destination (null when GPS not yet available)
  const distanceMeters =
    hasOfficerGPS && targetLat && targetLng
      ? haversineMeters(officerLat!, officerLng!, targetLat, targetLng)
      : null;
  const withinArrivalRange = distanceMeters !== null && distanceMeters <= ARRIVAL_THRESHOLD_M;
  // Show route only when we're more than 100 m away
  const showRoute = !withinArrivalRange;

  return (
    <div className="space-y-4">
      {/* ── Destination header ── */}
      <div className="rounded border border-[#e8a034]/30 bg-[#17120a] px-4 py-3">
        <div className="flex items-center gap-2">
          <Navigation className="h-4 w-4 text-[#e8a034]" />
          <div className="mono-id text-[#e8a034]">ENROUTE — ACTIVE NAVIGATION</div>
        </div>
        {withinArrivalRange ? (
          <div className="mt-1 text-[11px] font-semibold text-[#35b779]">
            You are within {Math.round(distanceMeters!)} m — you have arrived
          </div>
        ) : !hasOfficerGPS ? (
          <div className="mt-1 text-[11px] text-[#707987]">
            Allow browser GPS for turn-by-turn routing from your position
          </div>
        ) : distanceMeters !== null ? (
          <div className="mt-1 text-[11px] text-[#9ba5b3]">
            {distanceMeters >= 1000
              ? `${(distanceMeters / 1000).toFixed(1)} km to destination`
              : `${Math.round(distanceMeters)} m to destination`}
          </div>
        ) : null}
        <div className="mt-2 text-[14px] font-semibold text-[#f5f7fb]">{targetLabel}</div>
        {MAPPLS_KEY ? (
          <div className="mt-2 text-[12px] text-[#9ba5b3]">ETA shown on map · powered by Mappls</div>
        ) : route ? (
          <div className="mt-2 flex gap-4 text-[12px]">
            {route.duration_minutes !== null ? (
              <span className="flex items-center gap-1 text-[#35b779]">
                <Clock className="h-3.5 w-3.5" />
                {route.duration_minutes} min ETA
              </span>
            ) : null}
            {route.distance_km !== null ? (
              <span className="mono-id text-[#9ba5b3]">{route.distance_km} km</span>
            ) : null}
            {route.fallback ? (
              <span className="mono-id text-[#707987]">Straight-line (map API unavailable)</span>
            ) : null}
          </div>
        ) : routeError ? (
          <div className="mt-2 text-[12px] text-[#e05252]">Route unavailable — navigate manually</div>
        ) : (
          <div className="mt-2 text-[12px] text-[#707987]">Calculating route…</div>
        )}
      </div>

      {/* ── Live route map ── */}
      <div className="h-72 overflow-hidden rounded border border-[#252b35]">
        {MAPPLS_KEY ? (
          <MapplsMap
            key={withinArrivalRange ? "arrived" : "routing"}
            nearbyOfficers={nearbyOfficers}
            officerLat={fromLat}
            officerLng={fromLng}
            showRoute={showRoute}
            targetLabel={targetLabel}
            targetLat={targetLat ?? fromLat}
            targetLng={targetLng ?? fromLng}
          />
        ) : targetLat && targetLng ? (
          <LeafletMap
            officerLat={fromLat}
            officerLng={fromLng}
            route={route}
            targetLabel={targetLabel}
            targetLat={targetLat}
            targetLng={targetLng}
          />
        ) : (
          <div className="grid h-full place-items-center text-[12px] text-[#707987]">
            <div className="text-center">
              <MapPinned className="mx-auto mb-2 h-6 w-6 text-[#394252]" />
              Complaint has no GPS coordinates.
              <br />
              Navigate to: <span className="font-semibold text-[#dce2ea]">{targetLabel}</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Live chat with Command Centre ── */}
      <ChatPanel deploymentId={deploymentId} myName={myName} myRole={myRole} />

      {/* ── Carry checklist ── */}
      <div className="rounded border border-[#252b35] bg-[#10141b] px-4 py-4">
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-[#19b7a5]" />
          <div className="mono-id text-[#19b7a5]">
            Carry for {complaintTypeLabels[complaintType as keyof typeof complaintTypeLabels] ?? "this incident"}
          </div>
        </div>
        <ul className="space-y-1.5">
          {carryItems.map((item) => (
            <li className="flex items-center gap-2 text-[12px] text-[#dce2ea]" key={item}>
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#19b7a5]" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* ── Safety reminder ── */}
      <div className="flex items-start gap-2 rounded border border-[#e05252]/20 bg-[#e05252]/5 px-3 py-2 text-[11px] text-[#e05252]">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Do not use GPS navigation while driving. Have a second officer navigate or pull over to check route.
      </div>
    </div>
  );
}
