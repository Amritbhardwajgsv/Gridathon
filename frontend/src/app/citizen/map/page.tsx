"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, MapPin, RefreshCw } from "lucide-react";

const IncidentMapView = dynamic(() => import("@/components/IncidentMapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-[#a88778] text-[12px] gap-2">
      <Loader2 className="h-4 w-4 animate-spin" /> Loading map…
    </div>
  ),
});

export type MapIncident = {
  complaint_type: string;
  severity: string;
  location: string;
  zone: string | null;
  corridor: string | null;
  status: string;
  lat: number;
  lng: number;
  created_at: string;
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://gridathon-production.up.railway.app";

const SEV_DOT: Record<string, string> = {
  Critical: "bg-[#EF4444]",
  High:     "bg-[#F97316]",
  Medium:   "bg-[#3B82F6]",
  Low:      "bg-[#10B981]",
};

export default function IncidentMapPage() {
  const [incidents, setIncidents] = useState<MapIncident[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${API}/citizen/incidents/map`);
      if (res.ok) setIncidents(await res.json());
    } catch { /* silent */ }
    finally { setLoading(false); setLastFetch(new Date()); }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const byCritical = incidents.filter((i) => i.severity === "Critical").length;
  const byHigh     = incidents.filter((i) => i.severity === "High").length;

  return (
    <div className="flex min-h-screen flex-col bg-[#fffaf6] font-sans">
      {/* Header */}
      <header className="border-b-2 border-[#f2d8ca] bg-white px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-[12px] font-semibold text-[#795b4e] hover:text-[#342018]">
            <ArrowLeft className="h-3.5 w-3.5" /> DRISHTI
          </Link>
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-[#FFE600]" style={{ filter: "drop-shadow(0 0 4px #FFE60099)" }} />
            <span className="text-[13px] font-black uppercase tracking-widest text-[#08080F]">Live Incident Map</span>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1 rounded-full border border-[#f2d8ca] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#795b4e] hover:bg-[#fff0e8] disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </header>

      {/* Stats bar */}
      <div className="border-b border-[#f2d8ca] bg-[#fff8f4] px-4 py-2 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-4 text-[11px]">
          <span className="font-semibold text-[#342018]">{incidents.length} active incidents</span>
          {byCritical > 0 && (
            <span className="flex items-center gap-1 font-bold text-[#EF4444]">
              <span className="h-2 w-2 rounded-full bg-[#EF4444]" />{byCritical} Critical
            </span>
          )}
          {byHigh > 0 && (
            <span className="flex items-center gap-1 font-bold text-[#F97316]">
              <span className="h-2 w-2 rounded-full bg-[#F97316]" />{byHigh} High
            </span>
          )}
          <div className="ml-auto flex items-center gap-3">
            {Object.entries(SEV_DOT).map(([sev, cls]) => (
              <span key={sev} className="flex items-center gap-1 text-[#795b4e]">
                <span className={`h-2 w-2 rounded-full ${cls}`} />{sev}
              </span>
            ))}
          </div>
          {lastFetch && <span className="text-[#a88778]">Updated {lastFetch.toLocaleTimeString()}</span>}
        </div>
      </div>

      {/* Map */}
      <main className="flex-1 min-h-[calc(100vh-120px)]">
        {incidents.length === 0 && !loading ? (
          <div className="flex h-full min-h-[400px] items-center justify-center flex-col gap-3 text-[#a88778]">
            <MapPin className="h-8 w-8 opacity-30" />
            <p className="text-[13px]">No active incidents with location data</p>
          </div>
        ) : (
          <div className="h-[calc(100vh-120px)]">
            <IncidentMapView incidents={incidents} />
          </div>
        )}
      </main>
    </div>
  );
}
