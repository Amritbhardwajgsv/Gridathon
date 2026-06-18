"use client";

import Script from "next/script";
import { useEffect, useId, useRef, useState } from "react";

import type { PolicePersonnel } from "@/types/prediction";

import type { MaplsMap } from "@/types/mappls";

type Props = {
  officerLat: number;
  officerLng: number;
  targetLat: number;
  targetLng: number;
  targetLabel: string;
  showRoute?: boolean;
  nearbyOfficers?: PolicePersonnel[];
};

const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY ?? "";

// ── Component ───────────────────────────────────────────────────────────────

export default function MapplsRouteMap({
  officerLat,
  officerLng,
  targetLat,
  targetLng,
  targetLabel,
  showRoute = true,
  nearbyOfficers = [],
}: Props) {
  const uid          = useId().replace(/[^a-zA-Z0-9]/g, "");
  const containerId  = `mmap-${uid}`;
  const callbackName = `__mappls_cb_${uid}__` as `__mappls_cb_${string}__`;

  const mapRef    = useRef<MaplsMap | null>(null);
  const initedRef = useRef(false);

  // Keep latest prop values accessible inside the one-time useEffect
  // without re-triggering it on GPS ticks
  const propsRef = useRef({ officerLat, officerLng, targetLat, targetLng, targetLabel, showRoute, nearbyOfficers });
  useEffect(() => {
    propsRef.current = { officerLat, officerLng, targetLat, targetLng, targetLabel, showRoute, nearbyOfficers };
  });

  const [error, setError] = useState<string | null>(null);

  // One-time setup — runs once per mount, NOT on every GPS update
  useEffect(() => {
    if (initedRef.current) return;
    initedRef.current = true;

    function doInit() {
      if (!window.mappls) { setError("Mappls SDK unavailable"); return; }

      const { officerLat: oLat, officerLng: oLng, targetLat: tLat, targetLng: tLng, targetLabel: tLabel } =
        propsRef.current;

      try {
        // Mappls center = [longitude, latitude]
        const map = new window.mappls.Map(containerId, {
          center: { lat: oLat, lng: oLng },
          zoom:   13,
        });
        mapRef.current = map;

        // Nearby officer markers (teal — shown immediately after map init)
        if (window.mappls.Marker) {
          for (const officer of propsRef.current.nearbyOfficers) {
            if (!officer.current_latitude || !officer.current_longitude) continue;
            try {
              new window.mappls.Marker({
                map,
                position: { lat: officer.current_latitude, lng: officer.current_longitude },
                popupHtml: `<b>${officer.name}</b><br/>${officer.rank} · ${officer.badge_id}`,
                fitbounds: false,
              });
            } catch { /* ignore individual marker failures */ }
          }
        }

        // Direction plugin lives at /sdk/plugins — load dynamically after map ready
        function attachDirection() {
          // Skip route if officer is within arrival threshold
          if (!propsRef.current.showRoute) return;
          if (!window.mappls?.direction) {
            setError("Direction plugin unavailable");
            return;
          }
          try {
            window.mappls.direction({
              map,
              // Route FROM officer's real GPS TO the complaint location
              start: `${oLat},${oLng}`,
              end: {
                label:       tLabel,
                geoposition: `${tLat},${tLng}`,
              },
              resource:     "route_adv",
              profile:      "driving",
              routeColor:   "#e8a034",
              strokeWidth:  5,
              fitbounds:    true,
              autoRoute:    true,
              search:       false,
            });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            setError(`Route error: ${msg}`);
          }
        }

        const alreadyLoaded = document.querySelector(
          `script[src*="sdk/plugins"][src*="direction"]`
        );

        if (alreadyLoaded && typeof window.mappls.direction === "function") {
          attachDirection();
        } else if (alreadyLoaded) {
          // Script tag exists but plugin not yet ready — wait for it
          alreadyLoaded.addEventListener("load", attachDirection);
        } else {
          const s = document.createElement("script");
          s.src = `https://sdk.mappls.com/map/sdk/plugins?access_token=${MAPPLS_KEY}&v=3.0&libraries=direction`;
          s.onload = attachDirection;
          s.onerror = () => setError("Direction plugin failed to load");
          document.head.appendChild(s);
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(`Map error: ${msg}`);
        console.error("Mappls init error:", e);
      }
    }

    window[callbackName] = doInit;

    // If SDK already present from a cached load, fire immediately
    if (window.mappls) doInit();

    return () => {
      delete window[callbackName];
      try {
        const m = mapRef.current;
        if (m) { m.remove?.(); m.destroy?.(); }
      } catch { /* SDK cleanup errors are non-fatal */ }
      mapRef.current = null;
      initedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId, callbackName]);  // stable — never changes

  if (!MAPPLS_KEY) {
    return (
      <div className="grid h-full place-items-center text-center text-[12px] text-[#707987]">
        Set <span className="font-mono text-[#e8a034]">NEXT_PUBLIC_MAPPLS_KEY</span> in{" "}
        <span className="font-mono text-[#dce2ea]">frontend/.env.local</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="grid h-full place-items-center text-[12px] text-[#e05252] px-4 text-center">
        {error}
      </div>
    );
  }

  return (
    <>
      <Script
        src={`https://sdk.mappls.com/map/sdk?access_token=${MAPPLS_KEY}&v=3.0&callback=${callbackName}`}
        strategy="lazyOnload"
      />
      <div className="h-full min-h-[288px] w-full" id={containerId} />
    </>
  );
}
