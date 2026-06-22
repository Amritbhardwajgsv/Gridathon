"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { MaplsMap } from "@/types/mappls";

const API = process.env.NEXT_PUBLIC_API_URL || "https://gridathon-production.up.railway.app";
const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY || "";
const MAP_ID = "hotspot-map-container";

interface Hotspot {
  junction: string;
  count: number;
  lat: number;
  lng: number;
  high_pct: number;
  predicted_risk: number;
}

interface HotspotData {
  hotspots: Hotspot[];
  current_hour: number;
  hour_multiplier: number;
  hourly_rates: { hour: number; incidents: number; high_pct: number }[];
}

function riskColor(risk: number): string {
  if (risk >= 0.9) return "#ef4444";
  if (risk >= 0.7) return "#f97316";
  if (risk >= 0.5) return "#eab308";
  return "#22c55e";
}

function riskLabel(risk: number): string {
  if (risk >= 0.9) return "Critical";
  if (risk >= 0.7) return "High";
  if (risk >= 0.5) return "Medium";
  return "Low";
}

export default function HotspotsPage() {
  const mapRef = useRef<MaplsMap | null>(null);
  const initedRef = useRef(false);
  const [data, setData] = useState<HotspotData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [selected, setSelected] = useState<Hotspot | null>(null);
  const [mapReady, setMapReady] = useState(false);

  function loadData() {
    setFetchError(false);
    fetch(`${API}/citizen/incidents/hotspots`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: HotspotData) => { if (Array.isArray(d.hotspots)) setData(d); else throw new Error(); })
      .catch(() => setFetchError(true));
  }

  // Fetch hotspot data
  useEffect(() => { loadData(); }, []);

  // Init map (runs once after mount — container div is guaranteed to exist)
  useEffect(() => {
    if (initedRef.current || !MAPPLS_KEY) return;
    initedRef.current = true;

    function tryInit() {
      const sdk = window.mappls;
      if (!sdk) { setTimeout(tryInit, 300); return; }
      if (!document.getElementById(MAP_ID)) { setTimeout(tryInit, 100); return; }

      try {
        // v1.5 SDK takes a string ID, center is [lat, lng]
        const map = new sdk.Map(MAP_ID, {
          center: [12.9716, 77.5946],
          zoom: 11,
          search: false,
        });
        mapRef.current = map;
        setMapReady(true);
      } catch (e) {
        console.error("Hotspot map init error:", e);
      }
    }

    // Inject v1.5 SDK if not already present
    if (window.mappls) {
      tryInit();
      return;
    }

    const existing = document.getElementById("mappls-sdk-v15");
    if (!existing) {
      const s = document.createElement("script");
      s.id = "mappls-sdk-v15";
      s.src = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/map_load?v=1.5`;
      s.async = true;
      s.onload = () => tryInit();
      document.head.appendChild(s);
    } else {
      // Script already injected (e.g. HMR), wait for sdk
      tryInit();
    }
  }, []);

  // Add markers once BOTH map and data are ready
  useEffect(() => {
    if (!mapReady || !data || !mapRef.current) return;
    const sdk = window.mappls;
    if (!sdk?.Marker) return;

    const map = mapRef.current;

    data.hotspots.forEach((h) => {
      const size = Math.max(20, Math.min(48, h.predicted_risk * 52));
      const color = riskColor(h.predicted_risk);
      const encodedColor = encodeURIComponent(color);

      try {
        new sdk.Marker({
          map,
          // v1.5 uses {lat, lng} object or [lat, lng] array — use object to be safe
          position: { lat: h.lat, lng: h.lng },
          icon: {
            url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${size / 2}' cy='${size / 2}' r='${size / 2 - 2}' fill='${encodedColor}' opacity='0.85' stroke='white' stroke-width='2'/></svg>`,
            width: size,
            height: size,
          },
          popupHtml: `
            <div style="font-family:sans-serif;min-width:160px;padding:4px">
              <b style="color:${color}">${h.junction}</b><br/>
              Risk: <b>${riskLabel(h.predicted_risk)}</b> (${(h.predicted_risk * 100).toFixed(0)}%)<br/>
              Historical: ${h.count} incidents<br/>
              High priority: ${(h.high_pct * 100).toFixed(0)}%
            </div>
          `,
          popupOpen: false,
        });
      } catch { /* skip bad marker */ }
    });
  }, [mapReady, data]);

  const istHour = data?.current_hour ?? new Date().getHours();
  const peakHour = (istHour >= 8 && istHour <= 10) || (istHour >= 17 && istHour <= 20);

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[#f5c518]">Predictive Hotspot Map</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Current hour: {istHour}:00 IST
            {peakHour && <span className="ml-2 text-orange-400 font-semibold">⚠ Peak hour — risk elevated</span>}
            {data && <span className="ml-2 text-gray-500">· Multiplier {data.hour_multiplier}×</span>}
          </p>
        </div>
        <Link href="/" className="text-[11px] text-gray-500 hover:text-gray-300 transition-colors">← Back</Link>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* Map */}
        <div className="flex-1 relative">
          {/* The map div must have a fixed id — v1.5 SDK requires a string ID */}
          <div
            id={MAP_ID}
            style={{ width: "100%", height: "100%", minHeight: 500 }}
          />

          {!MAPPLS_KEY && (
            <div className="absolute inset-0 grid place-items-center bg-black/90 text-sm text-gray-400">
              Set <code className="mx-1 text-yellow-400">NEXT_PUBLIC_MAPPLS_KEY</code> env var
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-black/80 rounded-lg p-3 text-xs space-y-1 z-10">
            {([["Critical", "#ef4444", "≥90%"], ["High", "#f97316", "70–89%"], ["Medium", "#eab308", "50–69%"], ["Low", "#22c55e", "<50%"]] as const).map(([l, c, r]) => (
              <div key={l} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: c }} />
                <span className="text-gray-300">{l}</span>
                <span className="text-gray-500">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-72 bg-[#111] border-l border-[#2a2a2a] overflow-y-auto flex flex-col">
          <div className="p-3 border-b border-[#2a2a2a] text-xs text-gray-400 uppercase tracking-wide">
            Top Risk Junctions
          </div>
          {!data && !fetchError && (
            <div className="p-4 text-xs text-gray-500 animate-pulse">Loading hotspot data…</div>
          )}
          {fetchError && (
            <div className="p-4 text-xs text-red-400 space-y-2">
              <div>Failed to load hotspot data.</div>
              <button type="button" onClick={loadData} className="text-[#f5c518] hover:underline">Retry ↺</button>
            </div>
          )}
          {data?.hotspots.length === 0 && (
            <div className="p-4 text-xs text-gray-500">No hotspot data available.</div>
          )}
          {data?.hotspots.slice(0, 15).map((h) => (
            <div
              key={h.junction}
              className={`p-3 border-b border-[#1a1a1a] cursor-pointer hover:bg-[#1a1a1a] transition-colors ${selected?.junction === h.junction ? "bg-[#1a1a1a]" : ""}`}
              onClick={() => setSelected(h)}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white truncate">{h.junction}</span>
                <span
                  className="text-xs font-bold px-1.5 py-0.5 rounded ml-2 shrink-0"
                  style={{ background: riskColor(h.predicted_risk) + "33", color: riskColor(h.predicted_risk) }}
                >
                  {(h.predicted_risk * 100).toFixed(0)}%
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {h.count} historical · {(h.high_pct * 100).toFixed(0)}% high priority
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Selected panel */}
      {selected && (
        <div className="border-t border-[#2a2a2a] bg-[#111] p-4 flex items-start justify-between">
          <div>
            <div className="font-bold text-white">{selected.junction}</div>
            <div className="text-sm text-gray-400 mt-1">
              Predicted risk:{" "}
              <span style={{ color: riskColor(selected.predicted_risk) }} className="font-bold">
                {riskLabel(selected.predicted_risk)} ({(selected.predicted_risk * 100).toFixed(0)}%)
              </span>
              &nbsp;·&nbsp;{selected.count} historical incidents
              &nbsp;·&nbsp;{(selected.high_pct * 100).toFixed(0)}% high priority
              &nbsp;·&nbsp;{selected.lat.toFixed(4)}°N, {selected.lng.toFixed(4)}°E
            </div>
          </div>
          <button type="button" onClick={() => setSelected(null)} className="text-gray-500 hover:text-white ml-4">✕</button>
        </div>
      )}
    </div>
  );
}
