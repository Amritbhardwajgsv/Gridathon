"use client";

import { Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { MaplsMap, MaplsMarker } from "@/types/mappls";
import type { CitizenGrievance, PolicePersonnel } from "@/types/prediction";

// ── constants ─────────────────────────────────────────────────────────────────

const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY ?? "";
const BLR = { lat: 12.9716, lng: 77.5946 }; // Bengaluru, Karnataka

function point(latValue: number | null | undefined, lngValue: number | null | undefined) {
  const lat = Number(latValue);
  const lng = Number(lngValue);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat === 0 && lng === 0) return null; // unset — DB default, not a real location
  if (lat < 6 || lat > 38 || lng < 68 || lng > 98) return null; // must be within India
  return { lat, lng };
}

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
  const [officerQuery, setOfficerQuery] = useState("");
  const [selectedPersonnelId, setSelectedPersonnelId] = useState<string | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState<PolicePersonnel | null>(null);

  const locatedPersonnel = useMemo(
    () => personnel.filter((p) => point(p.current_latitude, p.current_longitude)),
    [personnel],
  );
  // Search ALL personnel — not just those with GPS — so officers without live location still appear
  const officerMatches = useMemo(() => {
    const query = officerQuery.trim().toLowerCase();
    if (!query) return [];
    return personnel.filter((p) =>
      p.name.toLowerCase().includes(query) || p.badge_id.toLowerCase().includes(query)
    ).slice(0, 8);
  }, [personnel, officerQuery]);

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
      const location = point(p.current_latitude, p.current_longitude);
      if (!location) continue;
      const avail = !!p.is_available;
      try {
        markersRef.current.push(new window.mappls!.Marker({
          map,
          position:  location,
          icon:      { url: avail ? ICON.available : ICON.onDuty, size: [28, 28], anchor: [14, 14] },
          fitbounds: false,
          popupHtml: `<div style="font:12px monospace;line-height:1.6">
            <b style="color:#0d1629">${p.badge_id} — ${p.name}</b><br/>
            ${p.rank} · ${p.unit_name}${p.zone ? `<br/>Zone: ${p.zone}` : ""}
            <br/><span style="color:${avail ? "#22d3ee" : "#3b82f6"};font-weight:600">
              ${avail ? "● Available" : "● On Duty"}</span></div>`,
        }) as MaplsMarker);
      } catch {
        // Some SDK builds reject custom icon objects; retain the location with a default marker.
        try {
          markersRef.current.push(new window.mappls!.Marker({
            map,
            position: location,
            fitbounds: false,
            popupHtml: `<b>${p.badge_id} — ${p.name}</b><br/>${p.rank} · ${p.unit_name}`,
          }) as MaplsMarker);
        } catch { /* skip only genuinely invalid markers */ }
      }
    }

    for (const c of cc) {
      const location = point(c.latitude, c.longitude);
      if (!location) continue;
      const sev  = c.severity ?? "Medium";
      const col  = SEV_COLOR[sev] ?? "#3b82f6";
      const icon = (ICON as Record<string, string>)[sev] ?? ICON.Medium;
      try {
        markersRef.current.push(new window.mappls!.Marker({
          map,
          position:  location,
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

    const selected = pp.find((p) => p.id === selectedPersonnelId);
    if (selected) focusOfficer(map, selected);
  }

  function focusOfficer(map: MaplsMap, officer: PolicePersonnel) {
    const location = point(officer.current_latitude, officer.current_longitude);
    if (!location) return;
    window.setTimeout(() => {
      // v3.0 SDK (Mapbox GL based) uses [lng, lat] for flyTo/setCenter
      const lngLat: [number, number] = [location.lng, location.lat];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const m = map as any;
      if (typeof m.flyTo === "function") {
        m.flyTo({ center: lngLat, zoom: 16 });
      } else if (typeof m.setView === "function") {
        m.setView([location.lat, location.lng], 16); // setView is Leaflet-style [lat, lng]
      } else {
        map.setCenter?.(lngLat);
        map.setZoom?.(16);
      }
    }, 100);
  }

  function selectOfficer(officer: PolicePersonnel) {
    setSelectedPersonnelId(officer.id);
    setSelectedOfficer(officer);
    setOfficerQuery(`${officer.name} · ${officer.badge_id}`);
    if (mapRef.current) focusOfficer(mapRef.current, officer);
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
          center: [BLR.lng, BLR.lat], // v3.0 SDK uses [lng, lat] (Mapbox GL format)
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

      {ready && (
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-full border border-[#f2c9b6] bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#795b4e] shadow-sm">
          {locatedPersonnel.length} live officer location{locatedPersonnel.length === 1 ? "" : "s"}
        </div>
      )}

      {ready && (
        <div className="absolute left-3 top-14 z-20 w-[min(280px,calc(100%-24px))]">
          <div className="flex items-center gap-2 rounded-xl border border-[#f2c9b6] bg-white/95 px-3 py-2 shadow-md backdrop-blur">
            <Search className="h-4 w-4 shrink-0 text-[#f47f5f]" />
            <input
              aria-label="Search live officer by name or badge ID"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#342018] outline-none placeholder:text-[#a88778]"
              onChange={(event) => {
                setOfficerQuery(event.target.value);
                setSelectedPersonnelId(null);
              }}
              placeholder="Officer name or badge ID"
              value={officerQuery}
            />
          </div>
          {officerQuery.trim() && !selectedPersonnelId && (
            <div className="mt-1 overflow-hidden rounded-xl border border-[#f2c9b6] bg-white shadow-lg">
              {officerMatches.length ? officerMatches.map((officer) => {
                const hasGps = !!point(officer.current_latitude, officer.current_longitude);
                return (
                  <button
                    className="flex w-full items-center justify-between gap-3 border-b border-[#f2d8ca] px-3 py-2.5 text-left last:border-0 hover:bg-[#fff0e8]"
                    key={officer.id}
                    onClick={() => selectOfficer(officer)}
                    type="button"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[12px] font-bold text-[#342018]">{officer.name}</span>
                      <span className="block font-mono text-[9px] text-[#a88778]">{officer.badge_id} · {officer.rank}</span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0">
                      {hasGps
                        ? <span title="Live GPS" className="h-2.5 w-2.5 rounded-full bg-[#22d3ee]" />
                        : <span title="No live GPS" className="h-2.5 w-2.5 rounded-full bg-[#d1d5db]" />
                      }
                    </span>
                  </button>
                );
              }) : (
                <div className="px-3 py-3 text-[11px] text-[#a88778]">No officer found.</div>
              )}
            </div>
          )}

          {/* Officer location card — shown after selecting */}
          {selectedOfficer && selectedPersonnelId && (
            <div className="mt-2 rounded-xl border border-[#f2c9b6] bg-white/97 px-4 py-3 shadow-lg text-[11px]">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-bold text-[#342018] text-[12px] truncate">{selectedOfficer.name}</div>
                  <div className="font-mono text-[9px] text-[#a88778] mt-0.5">{selectedOfficer.badge_id} · {selectedOfficer.rank} · {selectedOfficer.unit_name}</div>
                </div>
                <button
                  type="button"
                  className="text-[#a88778] hover:text-[#342018] shrink-0 mt-0.5"
                  onClick={() => { setSelectedPersonnelId(null); setSelectedOfficer(null); setOfficerQuery(""); }}
                >✕</button>
              </div>
              <div className="mt-2 pt-2 border-t border-[#f2e8e2]">
                {point(selectedOfficer.current_latitude, selectedOfficer.current_longitude) ? (
                  <>
                    <div className="flex items-center gap-1.5 text-[#22a870] font-semibold">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
                      Live GPS — map centered
                    </div>
                    <div className="font-mono text-[10px] text-[#795b4e] mt-1">
                      {Number(selectedOfficer.current_latitude).toFixed(5)}°N,&nbsp;
                      {Number(selectedOfficer.current_longitude).toFixed(5)}°E
                    </div>
                    {selectedOfficer.last_location_at && (
                      <div className="text-[9px] text-[#a88778] mt-0.5">
                        Last updated: {new Date(selectedOfficer.last_location_at).toLocaleString("en-IN")}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-1.5 text-[#9ca3af] font-semibold">
                      <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#d1d5db]" />
                      No live GPS
                    </div>
                    {selectedOfficer.last_location_at && selectedOfficer.current_latitude ? (
                      <div className="mt-1">
                        <div className="font-mono text-[10px] text-[#795b4e]">
                          Last known: {Number(selectedOfficer.current_latitude).toFixed(5)}°N,&nbsp;
                          {Number(selectedOfficer.current_longitude).toFixed(5)}°E
                        </div>
                        <div className="text-[9px] text-[#a88778] mt-0.5">
                          As of {new Date(selectedOfficer.last_location_at).toLocaleString("en-IN")}
                        </div>
                      </div>
                    ) : (
                      <div className="text-[9px] text-[#a88778] mt-1">No location data stored in DB</div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

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
