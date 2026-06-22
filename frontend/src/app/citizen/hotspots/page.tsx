"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
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

function riskColor(risk: number) {
  if (risk >= 0.9) return "#ef4444";
  if (risk >= 0.7) return "#f97316";
  if (risk >= 0.5) return "#FFE600";
  return "#22c55e";
}

function riskLabel(risk: number) {
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

  useEffect(() => { loadData(); }, []);

  // Init map once DOM is ready
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
      } catch (e) {
        console.error("Hotspot map init:", e);
      }
    }

    if (window.mappls) { tryInit(); return; }

    if (!document.getElementById("mappls-sdk-v15")) {
      const s = document.createElement("script");
      s.id = "mappls-sdk-v15";
      s.src = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/map_load?v=1.5`;
      s.async = true;
      s.onload = tryInit;
      document.head.appendChild(s);
    } else {
      tryInit();
    }
  }, []);

  // Add markers once both map and data are ready
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
          popupHtml: `<div style="font-family:monospace;font-size:12px;padding:6px;min-width:160px">
            <b style="color:${color}">${h.junction}</b><br/>
            Risk: <b>${riskLabel(h.predicted_risk)}</b> (${(h.predicted_risk * 100).toFixed(0)}%)<br/>
            ${h.count} historical incidents &middot; ${(h.high_pct * 100).toFixed(0)}% high priority
          </div>`,
          popupOpen: false,
        });
      } catch { /* skip */ }
    });
  }, [mapReady, data]);

  const istHour = data?.current_hour ?? new Date().getHours();
  const peakHour = (istHour >= 8 && istHour <= 10) || (istHour >= 17 && istHour <= 20);

  return (
    <div className="flex flex-col bg-[#08080F] text-[#F0F0F8]" style={{ height: "100dvh" }}>
      {/* Header — matches app-wide nav style */}
      <header className="flex items-center justify-between gap-4 border-b border-[#252535] px-5 py-3 shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-[#444455] hover:text-[#FFE600] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">Back</span>
          </Link>
          <span className="text-[#252535]">|</span>
          <div>
            <span className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
              Predictive Hotspot Map
            </span>
            <span className="ml-3 font-mono text-[10px] text-[#444455]">
              {istHour}:00 IST
              {data && <span className="ml-2">· {data.hour_multiplier}× multiplier</span>}
            </span>
          </div>
        </div>
        {peakHour && (
          <div className="flex items-center gap-1.5 rounded border border-[#f97316]/30 bg-[#f97316]/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[#f97316]">
            <AlertTriangle className="h-3 w-3" />
            Peak hour — elevated risk
          </div>
        )}
      </header>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map — explicit height via parent */}
        <div className="flex-1 relative overflow-hidden">
          <div id={MAP_ID} style={{ width: "100%", height: "100%" }} />

          {!MAPPLS_KEY && (
            <div className="absolute inset-0 grid place-items-center bg-[#08080F] text-[12px] text-[#444455]">
              Set <code className="mx-1 text-[#FFE600]">NEXT_PUBLIC_MAPPLS_KEY</code>
            </div>
          )}

          {/* Legend */}
          <div className="absolute bottom-4 left-4 z-10 rounded border border-[#252535] bg-[#0D0D15]/90 px-3 py-2 backdrop-blur">
            {([["Critical", "#ef4444", "≥90%"], ["High", "#f97316", "70–89%"], ["Medium", "#FFE600", "50–69%"], ["Low", "#22c55e", "<50%"]] as const).map(([l, c, r]) => (
              <div key={l} className="flex items-center gap-2 py-0.5">
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: c }} />
                <span className="font-mono text-[10px] text-[#8888A0]">{l}</span>
                <span className="font-mono text-[9px] text-[#444455]">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 shrink-0 border-l border-[#252535] bg-[#0D0D15] flex flex-col overflow-hidden">
          <div className="border-b border-[#252535] px-4 py-2.5">
            <span className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">
              Top Risk Junctions
            </span>
          </div>

          <div className="flex-1 overflow-y-auto">
            {!data && !fetchError && (
              <div className="px-4 py-4 font-mono text-[11px] text-[#444455] animate-pulse">
                Loading hotspot data…
              </div>
            )}
            {fetchError && (
              <div className="px-4 py-4 space-y-2">
                <div className="font-mono text-[11px] text-[#ef4444]">Failed to load data.</div>
                <button type="button" onClick={loadData} className="font-mono text-[10px] text-[#FFE600] hover:underline">
                  Retry ↺
                </button>
              </div>
            )}
            {data?.hotspots.map((h, i) => (
              <button
                key={h.junction}
                type="button"
                onClick={() => setSelected(selected?.junction === h.junction ? null : h)}
                className={`w-full border-b border-[#1a1a24] px-4 py-3 text-left transition-colors hover:bg-[#13131F] ${selected?.junction === h.junction ? "bg-[#13131F]" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] text-[#444455] shrink-0">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-[12px] font-semibold text-[#F0F0F8] truncate">{h.junction}</span>
                  </div>
                  <span
                    className="font-mono text-[10px] font-bold shrink-0 px-1.5 py-0.5 rounded"
                    style={{ color: riskColor(h.predicted_risk), background: riskColor(h.predicted_risk) + "22" }}
                  >
                    {(h.predicted_risk * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="mt-0.5 font-mono text-[9px] text-[#444455] pl-7">
                  {h.count} incidents · {(h.high_pct * 100).toFixed(0)}% high priority
                </div>
              </button>
            ))}
          </div>

          {/* Selected detail */}
          {selected && (
            <div className="border-t border-[#252535] bg-[#0A0A14] px-4 py-3 shrink-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: riskColor(selected.predicted_risk) }}>
                    {riskLabel(selected.predicted_risk)} Risk
                  </div>
                  <div className="mt-0.5 text-[13px] font-semibold text-[#F0F0F8]">{selected.junction}</div>
                </div>
                <button type="button" onClick={() => setSelected(null)} className="font-mono text-[11px] text-[#444455] hover:text-[#F0F0F8]">✕</button>
              </div>
              <div className="mt-2 font-mono text-[10px] text-[#8888A0] space-y-0.5">
                <div>Risk score: <span className="text-[#F0F0F8]">{(selected.predicted_risk * 100).toFixed(0)}%</span></div>
                <div>Historical: <span className="text-[#F0F0F8]">{selected.count} incidents</span></div>
                <div>High priority: <span className="text-[#F0F0F8]">{(selected.high_pct * 100).toFixed(0)}%</span></div>
                <div className="text-[#444455]">{selected.lat.toFixed(4)}°N {selected.lng.toFixed(4)}°E</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
