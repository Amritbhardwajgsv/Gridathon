"use client";

import { useEffect, useId, useRef, useState } from "react";

import type { MaplsMap, MaplsMarker } from "@/types/mappls";
import type { CitizenGrievance, PolicePersonnel } from "@/types/prediction";

// ── constants ─────────────────────────────────────────────────────────────────

const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY ?? "";
const BLR = { lat: 12.9716, lng: 77.5946 }; // Bengaluru, Karnataka

const SEV_COLOR: Record<string, string> = {
  Critical: "#ef4444",
  High:     "#f59e0b",
  Medium:   "#3b82f6",
  Low:      "#10b981",
};

function svgIcon(fill: string, stroke: string, size = 20, dashed = false) {
  const r   = size / 2 - 2;
  const da  = dashed ? `stroke-dasharray="4 3"` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><circle cx="${size/2}" cy="${size/2}" r="${r}" fill="${fill}" fill-opacity="${dashed ? .45 : .9}" stroke="${stroke}" stroke-width="2" ${da}/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const ICON = {
  available: svgIcon("#22d3ee", "#fff"),
  onDuty:    svgIcon("#3b82f6", "#fff"),
  Critical:  svgIcon("#ef4444", "#ef4444", 24, true),
  High:      svgIcon("#f59e0b", "#f59e0b", 22, true),
  Medium:    svgIcon("#3b82f6", "#3b82f6", 20, true),
  Low:       svgIcon("#10b981", "#10b981", 20, true),
};

// ── component ─────────────────────────────────────────────────────────────────

export default function PersonnelMap({
  personnel,
  complaints,
}: {
  personnel:  PolicePersonnel[];
  complaints: CitizenGrievance[];
}) {
  const uid         = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerId = `pm-${uid}`;
  const cbKey       = `__mmap_${uid}__` as `__mmap_${string}__`;

  const mapRef     = useRef<MaplsMap | null>(null);
  const markersRef = useRef<MaplsMarker[]>([]);
  const initedRef  = useRef(false);
  const dataRef    = useRef({ personnel, complaints });

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Mirror latest props into a ref so marker draws always use fresh data
  // without triggering the one-time init effect
  useEffect(() => { dataRef.current = { personnel, complaints }; });

  function clearMarkers() {
    for (const m of markersRef.current) {
      try { m.remove?.(); m.setMap?.(null); } catch { /* ignore */ }
    }
    markersRef.current = [];
  }

  function addMarkers(map: MaplsMap) {
    if (!window.mappls?.Marker) return;
    clearMarkers();
    const { personnel: pp, complaints: cc } = dataRef.current;

    for (const p of pp) {
      if (!p.current_latitude || !p.current_longitude) continue;
      const avail = !!p.is_available;
      try {
        markersRef.current.push(new window.mappls!.Marker({
          map,
          position:  { lat: p.current_latitude, lng: p.current_longitude },
          icon:      { url: avail ? ICON.available : ICON.onDuty, size: [20, 20], anchor: [10, 10] },
          fitbounds: false,
          popupHtml: `<div style="font:12px monospace;line-height:1.6">
            <b style="color:#0d1629">${p.badge_id} — ${p.name}</b><br/>
            ${p.rank} · ${p.unit_name}${p.zone ? `<br/>Zone: ${p.zone}` : ""}
            <br/><span style="color:${avail ? "#22d3ee" : "#3b82f6"};font-weight:600">
              ${avail ? "● Available" : "● On Duty"}</span></div>`,
        }) as MaplsMarker);
      } catch { /* skip bad marker */ }
    }

    for (const c of cc) {
      if (!c.latitude || !c.longitude) continue;
      const sev  = c.severity ?? "Medium";
      const col  = SEV_COLOR[sev] ?? "#3b82f6";
      const icon = (ICON as Record<string, string>)[sev] ?? ICON.Medium;
      try {
        markersRef.current.push(new window.mappls!.Marker({
          map,
          position:  { lat: c.latitude, lng: c.longitude },
          icon:      { url: icon, size: [22, 22], anchor: [11, 11] },
          fitbounds: false,
          popupHtml: `<div style="font:12px monospace;line-height:1.6">
            <b style="color:#0d1629">${c.tracking_id}</b><br/>
            ${c.location_text}<br/>
            <span style="color:${col};font-weight:600">${sev} · ${c.complaint_type.replace(/_/g," ")}</span>
            ${c.corridor ? `<br/><span style="color:#666;font-size:11px">${c.corridor}</span>` : ""}
          </div>`,
        }) as MaplsMarker);
      } catch { /* skip bad marker */ }
    }
  }

  // ── One-time SDK init ──────────────────────────────────────────────────────
  //
  // IMPORTANT: we inject the <script> tag programmatically here — NOT via
  // Next.js <Script>.  <Script strategy="lazyOnload"> is hoisted into
  // <head> by Next.js and its callback can fire before useEffect runs,
  // meaning document.getElementById(containerId) returns null.
  //
  // useEffect is guaranteed to run AFTER the DOM has been committed, so
  // the container div always exists when doInit() is called.
  useEffect(() => {
    if (initedRef.current || !MAPPLS_KEY) return;
    initedRef.current = true;

    function doInit() {
      if (!window.mappls) { setError("Mappls SDK failed to load"); return; }
      // Verify the container div exists before passing its id to the SDK
      if (!document.getElementById(containerId)) {
        setError("Map container not ready — please refresh");
        return;
      }
      try {
        const map = new window.mappls.Map(containerId, {
          center: { lat: BLR.lat, lng: BLR.lng },
          zoom:   12,
        });
        mapRef.current = map;
        addMarkers(map);
        setReady(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    }

    // If SDK is already present (cached from a prior page), fire immediately
    if (window.mappls) {
      doInit();
      return;
    }

    // Register callback BEFORE injecting the script tag so the SDK can call
    // it as soon as it finishes loading
    window[cbKey] = doInit;

    // Check if this exact script URL is already loading (e.g. HMR)
    const src = `https://sdk.mappls.com/map/sdk?access_token=${MAPPLS_KEY}&v=3.0&callback=${cbKey}`;
    if (!document.querySelector(`script[src="${src}"]`)) {
      const s   = document.createElement("script");
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
  }, []); // run exactly once per mount

  // Re-draw markers when data refreshes (30-second poll)
  useEffect(() => {
    if (ready && mapRef.current) addMarkers(mapRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, personnel, complaints]);

  // ── Render ─────────────────────────────────────────────────────────────────
  //
  // The container div MUST always be in the DOM, even when showing errors,
  // because the SDK holds a reference to it.  Overlays sit on top via
  // absolute positioning rather than replacing the div.

  return (
    <div className="relative h-full min-h-[288px] w-full">
      {/* SDK-managed map surface — always present */}
      <div className="h-full w-full" id={containerId} />

      {/* No-key notice */}
      {!MAPPLS_KEY && (
        <div className="absolute inset-0 grid place-items-center bg-[#060c18] p-6 text-center text-[12px] text-[#3d5278]">
          Set <span className="mx-1 font-mono text-[#22d3ee]">NEXT_PUBLIC_MAPPLS_KEY</span>
          in <span className="ml-1 font-mono text-[#dde8f5]">frontend/.env.local</span>
        </div>
      )}

      {/* SDK error notice */}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-[#060c18]/90 p-6 text-center text-[12px] text-[#ef4444]">
          {error}
        </div>
      )}
    </div>
  );
}
