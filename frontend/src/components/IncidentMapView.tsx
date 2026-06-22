"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { MaplsMap, MaplsMarker } from "@/types/mappls";
import type { MapIncident } from "@/app/citizen/map/page";

const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY ?? "";
const BLR = { lat: 12.9716, lng: 77.5946 };

const SEV_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  High:     "#f97316",
  Medium:   "#3b82f6",
  Low:      "#10b981",
};

function svgPin(fill: string, size = 24) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2-2}" fill="${fill}" fill-opacity="0.85" stroke="#fff" stroke-width="2"/>
  </svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function IncidentMapView({ incidents }: { incidents: MapIncident[] }) {
  const uid         = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerId = `imap-${uid}`;
  const cbKey       = `__mmap_${uid}__` as `__mmap_${string}__`;

  const mapRef     = useRef<MaplsMap | null>(null);
  const markersRef = useRef<MaplsMarker[]>([]);
  const initedRef  = useRef(false);
  const dataRef    = useRef(incidents);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { dataRef.current = incidents; });

  function clearMarkers() {
    for (const m of markersRef.current) {
      try { m.remove?.(); m.setMap?.(null); } catch { /* ignore */ }
    }
    markersRef.current = [];
  }

  function addMarkers(map: MaplsMap) {
    if (!window.mappls?.Marker) return;
    clearMarkers();
    for (const inc of dataRef.current) {
      const lat = Number(inc.lat);
      const lng = Number(inc.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      const col  = SEV_COLOR[inc.severity] ?? SEV_COLOR.Medium;
      const size = inc.severity === "Critical" ? 28 : inc.severity === "High" ? 26 : 22;
      const icon = svgPin(col, size);
      const label = inc.complaint_type.replace(/_/g, " ");
      try {
        markersRef.current.push(new window.mappls!.Marker({
          map,
          position:  { lat, lng },
          icon:      { url: icon, size: [size, size], anchor: [size / 2, size / 2] },
          fitbounds: false,
          popupHtml: `<div style="font:12px sans-serif;line-height:1.6;max-width:200px">
            <b style="color:#342018;text-transform:capitalize">${label}</b><br/>
            <span style="color:#795b4e">${inc.location || "—"}</span><br/>
            <span style="color:${col};font-weight:700">${inc.severity}</span>
            ${inc.corridor ? `<br/><span style="color:#aaa;font-size:11px">${inc.corridor}</span>` : ""}
            <br/><span style="color:#a88778;font-size:11px">${timeAgo(inc.created_at)}</span>
          </div>`,
        }) as MaplsMarker);
      } catch { /* skip bad marker */ }
    }
  }

  useEffect(() => {
    if (initedRef.current || !MAPPLS_KEY) return;
    initedRef.current = true;

    function doInit() {
      if (!window.mappls) { setError("Mappls SDK failed to load"); return; }
      if (!document.getElementById(containerId)) { setError("Map container not ready"); return; }
      try {
        const map = new window.mappls.Map(containerId, { center: [BLR.lat, BLR.lng], zoom: 11 });
        mapRef.current = map;
        addMarkers(map);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    if (window.mappls) { doInit(); return; }

    window[cbKey] = doInit;
    const src = `https://sdk.mappls.com/map/sdk?access_token=${MAPPLS_KEY}&v=3.0&callback=${cbKey}`;
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s = document.createElement("script");
      s.src     = src;
      s.async   = true;
      s.onerror = () => setError("Failed to load Mappls SDK — check NEXT_PUBLIC_MAPPLS_KEY");
      document.head.appendChild(s);
    }

    return () => {
      delete window[cbKey];
      clearMarkers();
      try { const m = mapRef.current; m?.remove?.(); m?.destroy?.(); } catch { /* ignore */ }
      mapRef.current    = null;
      initedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (ready && mapRef.current) addMarkers(mapRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, incidents]);

  return (
    <div className="relative h-full w-full" style={{ minHeight: "inherit" }}>
      <div className="h-full w-full" id={containerId} style={{ minHeight: "inherit" }} />

      {!MAPPLS_KEY && (
        <div className="absolute inset-0 grid place-items-center bg-[#fffaf6] text-[12px] text-[#a88778]">
          Set <code className="mx-1 text-[#342018]">NEXT_PUBLIC_MAPPLS_KEY</code> in{" "}
          <code className="ml-1 text-[#342018]">frontend/.env.local</code>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-[#fffaf6]/90 text-[12px] text-[#EF4444]">
          {error}
        </div>
      )}
    </div>
  );
}
