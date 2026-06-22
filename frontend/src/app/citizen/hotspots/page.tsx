"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Radio } from "lucide-react";
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
}

function riskColor(risk: number) {
  if (risk >= 0.9) return "#ef4444";
  if (risk >= 0.7) return "#f97316";
  if (risk >= 0.5) return "#f59e0b";
  return "#10b981";
}

function riskLabel(risk: number) {
  if (risk >= 0.9) return "Critical";
  if (risk >= 0.7) return "High";
  if (risk >= 0.5) return "Medium";
  return "Low";
}

export default function HotspotsPage() {
  const mapRef    = useRef<MaplsMap | null>(null);
  const initedRef = useRef(false);
  const [data,       setData]       = useState<HotspotData | null>(null);
  const [fetchError, setFetchError] = useState(false);
  const [selected,   setSelected]   = useState<Hotspot | null>(null);
  const [mapReady,   setMapReady]   = useState(false);

  function loadData() {
    setFetchError(false);
    fetch(`${API}/citizen/incidents/hotspots`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((d: HotspotData) => { if (Array.isArray(d.hotspots)) setData(d); else throw new Error(); })
      .catch(() => setFetchError(true));
  }

  useEffect(() => { loadData(); }, []);

  function panTo(h: Hotspot) {
    setSelected(selected?.junction === h.junction ? null : h);
    const map = mapRef.current;
    if (!map) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = map as any;
    const pos = { lat: h.lat, lng: h.lng };
    if (typeof m.setCenter === "function") { m.setCenter(pos); m.setZoom?.(14); }
    else if (typeof m.flyTo === "function") m.flyTo({ center: pos, zoom: 14 });
    else if (typeof m.setView === "function") m.setView([h.lat, h.lng], 14);
  }

  useEffect(() => {
    if (initedRef.current || !MAPPLS_KEY) return;
    initedRef.current = true;

    function tryInit() {
      const sdk = window.mappls;
      if (!sdk) { setTimeout(tryInit, 300); return; }
      if (!document.getElementById(MAP_ID)) { setTimeout(tryInit, 100); return; }
      try {
        const map = new sdk.Map(MAP_ID, {
          center: { lat: 12.9716, lng: 77.5946 },
          zoom: 11,
          search: false,
        });
        mapRef.current = map;
        setMapReady(true);
      } catch (e) { console.error("Hotspot map init:", e); }
    }

    if (window.mappls) { tryInit(); return; }
    if (!document.getElementById("mappls-sdk-v15")) {
      const s = document.createElement("script");
      s.id = "mappls-sdk-v15";
      s.src = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/map_load?v=1.5`;
      s.async = true;
      s.onload = tryInit;
      document.head.appendChild(s);
    } else { tryInit(); }
  }, []);

  useEffect(() => {
    if (!mapReady || !data || !mapRef.current) return;
    const sdk = window.mappls;
    if (!sdk?.Marker) return;
    const map = mapRef.current;
    data.hotspots.forEach((h) => {
      const size = Math.max(20, Math.min(50, h.predicted_risk * 54));
      const color = riskColor(h.predicted_risk);
      try {
        new sdk.Marker({
          map,
          position: { lat: h.lat, lng: h.lng },
          icon: {
            url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${size/2}' cy='${size/2}' r='${size/2-2}' fill='${encodeURIComponent(color)}' opacity='0.85' stroke='white' stroke-width='2'/></svg>`,
            width: size,
            height: size,
          },
          popupHtml: `<div style="font-family:monospace;font-size:12px;padding:6px;min-width:160px;color:#342018">
            <b style="color:${color}">${h.junction}</b><br/>
            Risk: <b>${riskLabel(h.predicted_risk)}</b> (${(h.predicted_risk * 100).toFixed(0)}%)<br/>
            ${h.count} historical &middot; ${(h.high_pct * 100).toFixed(0)}% high priority
          </div>`,
          popupOpen: false,
        });
      } catch { /* skip */ }
    });
  }, [mapReady, data]);

  const istHour  = data?.current_hour ?? new Date().getHours();
  const peakHour = (istHour >= 8 && istHour <= 10) || (istHour >= 17 && istHour <= 20);

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf6] text-[#342018]">

      {/* ── Nav — same as main landing page ─────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b-2 border-[#f2d8ca] bg-[#fffaf6]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#ffd62f]">
              <Radio className="h-4 w-4 text-[#342018]" />
            </div>
            <div>
              <div className="font-mono text-[13px] font-bold tracking-[0.22em] text-[#342018]">DRISHTI</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#a88778]">Bengaluru Police · Traffic Ops</div>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link className="flex items-center gap-1.5 text-[#795b4e] hover:text-[#342018] transition-colors text-[12px] font-semibold uppercase tracking-[0.06em]" href="/">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Link>
            {peakHour && (
              <div className="flex items-center gap-1.5 rounded-full border border-[#f97316]/40 bg-[#f97316]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f97316]">
                <AlertTriangle className="h-3 w-3" />
                Peak Hour
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-7xl px-6 py-6">
        <div className="section-kicker mb-1 text-[#f47f5f]">+ Predictive Intelligence</div>
        <h1 className="text-[28px] font-black uppercase leading-none tracking-[-0.01em] text-[#342018]">
          Hotspot Map
        </h1>
        <p className="mt-1 text-[12px] text-[#a88778]">
          Current hour: {istHour}:00 IST
          {data && <span className="ml-2">· Risk multiplier {data.hour_multiplier}×</span>}
          {peakHour && <span className="ml-2 font-semibold text-[#f97316]">— elevated risk window</span>}
        </p>
      </div>

      {/* ── Body — concrete height so Mappls SDK gets a real pixel size ── */}
      <div
        className="mx-auto flex w-full max-w-7xl gap-5 px-6 pb-6"
        style={{ height: "calc(100vh - 210px)" }}
      >

        {/* Map card */}
        <div className="browser-card flex-1 overflow-hidden flex flex-col">
          <div className="browser-card-header shrink-0">
            <span className="browser-dot browser-dot-red" />
            <span className="browser-dot browser-dot-yellow" />
            <span className="browser-dot browser-dot-green" />
            <span className="ml-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#795b4e]">
              Bengaluru · Live Risk Map
            </span>
            {/* Legend inline */}
            <span className="ml-auto flex items-center gap-3">
              {([["Critical", "#ef4444"], ["High", "#f97316"], ["Medium", "#f59e0b"], ["Low", "#10b981"]] as const).map(([l, c]) => (
                <span key={l} className="flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: c }} />
                  <span className="font-mono text-[9px] text-[#a88778]">{l}</span>
                </span>
              ))}
            </span>
          </div>
          <div id={MAP_ID} className="flex-1" />
          {!MAPPLS_KEY && (
            <div className="absolute inset-0 grid place-items-center bg-[#fffaf6] text-[12px] text-[#a88778]">
              Set <code className="mx-1 text-[#f47f5f]">NEXT_PUBLIC_MAPPLS_KEY</code>
            </div>
          )}
        </div>

        {/* Sidebar — same height as body container */}
        <div className="w-72 shrink-0 flex flex-col gap-3 overflow-hidden">
          <div className="browser-card flex-1 overflow-hidden flex flex-col">
            <div className="browser-card-header">
              <span className="browser-dot browser-dot-red" />
              <span className="browser-dot browser-dot-yellow" />
              <span className="browser-dot browser-dot-green" />
              <span className="ml-3 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-[#795b4e]">
                Top Risk Junctions
              </span>
            </div>

            <div className="flex-1 overflow-y-auto">
              {!data && !fetchError && (
                <div className="px-4 py-4 font-mono text-[11px] text-[#a88778] animate-pulse">
                  Loading hotspot data…
                </div>
              )}
              {fetchError && (
                <div className="px-4 py-4 space-y-2">
                  <div className="font-mono text-[11px] text-[#ef4444]">Failed to load data.</div>
                  <button type="button" onClick={loadData} className="font-mono text-[10px] text-[#f47f5f] hover:underline">
                    Retry ↺
                  </button>
                </div>
              )}
              {data?.hotspots.map((h, i) => (
                <button
                  key={h.junction}
                  type="button"
                  onClick={() => panTo(h)}
                  className={`w-full border-b border-[#f2d8ca] px-4 py-3 text-left transition-colors hover:bg-[#fff0e8] ${selected?.junction === h.junction ? "bg-[#fff0e8]" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[10px] text-[#a88778] shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className="text-[12px] font-semibold text-[#342018] truncate">{h.junction}</span>
                    </div>
                    <span
                      className="font-mono text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded-full border"
                      style={{ color: riskColor(h.predicted_risk), borderColor: riskColor(h.predicted_risk) + "55", background: riskColor(h.predicted_risk) + "15" }}
                    >
                      {(h.predicted_risk * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] text-[#a88778] pl-7">
                    {h.count} incidents · {(h.high_pct * 100).toFixed(0)}% high priority
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Selected detail card */}
          {selected && (
            <div className="browser-card shrink-0">
              <div className="browser-card-header">
                <span className="browser-dot browser-dot-red" />
                <span className="browser-dot browser-dot-yellow" />
                <span className="browser-dot browser-dot-green" />
                <span className="ml-auto font-mono text-[9px]" style={{ color: riskColor(selected.predicted_risk) }}>
                  {riskLabel(selected.predicted_risk).toUpperCase()}
                </span>
              </div>
              <div className="p-4">
                <div className="text-[14px] font-bold text-[#342018]">{selected.junction}</div>
                <div className="mt-3 space-y-1.5">
                  {[
                    ["Risk score", `${(selected.predicted_risk * 100).toFixed(0)}%`],
                    ["Historical", `${selected.count} incidents`],
                    ["High priority", `${(selected.high_pct * 100).toFixed(0)}%`],
                    ["Coordinates", `${selected.lat.toFixed(4)}°N ${selected.lng.toFixed(4)}°E`],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-center justify-between text-[11px]">
                      <span className="text-[#a88778]">{label}</span>
                      <span className="font-semibold text-[#342018]">{value}</span>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setSelected(null)} className="mt-3 w-full text-center font-mono text-[9px] text-[#a88778] hover:text-[#342018]">
                  Dismiss ✕
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
