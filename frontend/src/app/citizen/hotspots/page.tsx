"use client";

import { useEffect, useRef, useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://gridathon-production.up.railway.app";
const MAPPLS_KEY = process.env.NEXT_PUBLIC_MAPPLS_KEY || "";

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

import type { MaplsMap } from "@/types/mappls";

export default function HotspotsPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MaplsMap | null>(null);
  const [data, setData] = useState<HotspotData | null>(null);
  const [sdkReady, setSdkReady] = useState(false);
  const [selected, setSelected] = useState<Hotspot | null>(null);

  useEffect(() => {
    fetch(`${API}/citizen/incidents/hotspots`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (document.getElementById("mappls-sdk")) { setSdkReady(true); return; }
    const script = document.createElement("script");
    script.id = "mappls-sdk";
    script.src = `https://apis.mappls.com/advancedmaps/v1/${MAPPLS_KEY}/map_load?v=1.5`;
    script.async = true;
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!sdkReady || !mapRef.current || !data) return;
    const init = () => {
      if (!window.mappls) { setTimeout(init, 300); return; }
      if (mapInstance.current) {
        mapInstance.current.remove?.();
        mapInstance.current = null;
      }
      const map = new window.mappls.Map(mapRef.current, {
        center: [12.9716, 77.5946],
        zoom: 11,
        search: false,
      });
      mapInstance.current = map;

      map.on?.("load", () => {
        data.hotspots.forEach((h) => {
          const size = Math.max(20, Math.min(48, h.predicted_risk * 52));
          const color = riskColor(h.predicted_risk);
          const el = document.createElement("div");
          el.style.cssText = `
            width:${size}px; height:${size}px; border-radius:50%;
            background:${color}; opacity:0.75; border:2px solid #fff;
            cursor:pointer; box-shadow:0 0 ${size/2}px ${color};
          `;
          el.title = h.junction;
          el.addEventListener("click", () => setSelected(h));

          new window.mappls.Marker({
            map,
            position: [h.lat, h.lng],
            icon: {
              url: `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}'><circle cx='${size/2}' cy='${size/2}' r='${size/2-2}' fill='${encodeURIComponent(color)}' opacity='0.8' stroke='white' stroke-width='2'/></svg>`,
              size: [size, size],
              anchor: [size/2, size/2],
            },
            popupHtml: `
              <div style="font-family:sans-serif;min-width:160px">
                <b style="color:${color}">${h.junction}</b><br/>
                Risk: <b>${riskLabel(h.predicted_risk)}</b> (${(h.predicted_risk*100).toFixed(0)}%)<br/>
                Historical: ${h.count} incidents<br/>
                High priority: ${(h.high_pct*100).toFixed(0)}%
              </div>
            `,
            popupOpen: false,
          });
        });
      });
    };
    init();
  }, [sdkReady, data]);

  const istHour = data?.current_hour ?? new Date().getHours();
  const peakHour = istHour >= 8 && istHour <= 10 || istHour >= 17 && istHour <= 20;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-[#2a2a2a]">
        <h1 className="text-xl font-bold text-[#f5c518]">Predictive Hotspot Map</h1>
        <p className="text-gray-400 text-sm mt-0.5">
          Current hour: {istHour}:00 IST
          {peakHour && <span className="ml-2 text-orange-400 font-semibold">⚠ Peak hour — risk elevated</span>}
          {data && <span className="ml-2 text-gray-500">· Multiplier {data.hour_multiplier}×</span>}
        </p>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} className="w-full h-full min-h-[500px]" />
          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-black/80 rounded-lg p-3 text-xs space-y-1">
            {[["Critical", "#ef4444", "≥90%"], ["High", "#f97316", "70–89%"], ["Medium", "#eab308", "50–69%"], ["Low", "#22c55e", "<50%"]].map(([l, c, r]) => (
              <div key={l} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ background: c }} />
                <span className="text-gray-300">{l}</span>
                <span className="text-gray-500">{r}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="w-72 bg-[#111] border-l border-[#2a2a2a] overflow-y-auto">
          <div className="p-3 border-b border-[#2a2a2a] text-xs text-gray-400 uppercase tracking-wide">
            Top Risk Junctions
          </div>
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
              Predicted risk: <span style={{ color: riskColor(selected.predicted_risk) }} className="font-bold">
                {riskLabel(selected.predicted_risk)} ({(selected.predicted_risk * 100).toFixed(0)}%)
              </span>
              &nbsp;·&nbsp;{selected.count} historical incidents
              &nbsp;·&nbsp;{(selected.high_pct * 100).toFixed(0)}% high priority
            </div>
          </div>
          <button onClick={() => setSelected(null)} className="text-gray-500 hover:text-white ml-4">✕</button>
        </div>
      )}
    </div>
  );
}
