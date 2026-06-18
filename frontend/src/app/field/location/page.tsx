"use client";

import { Crosshair, Loader2, Radio, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { updatePersonnelLocation } from "@/lib/api";
import { formatDateTime } from "@/lib/format";

export default function FieldLocationPage() {
  const [badgeId, setBadgeId] = useState("");
  const [status, setStatus] = useState("Enter badge ID and start polling.");
  const [lastSeen, setLastSeen] = useState("");
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, []);

  function startPolling() {
    if (!badgeId.trim()) {
      setStatus("Badge ID is required.");
      return;
    }
    setIsPolling(true);
    pollOnce();
    intervalRef.current = window.setInterval(pollOnce, 30000);
  }

  function stopPolling() {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    setStatus("Polling stopped.");
  }

  function pollOnce() {
    if (!navigator.geolocation) {
      setStatus("Geolocation is not supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const response = await updatePersonnelLocation(badgeId.trim(), {
            accuracy_meters: position.coords.accuracy,
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setLastSeen(response.last_location_at);
          setStatus(`Location updated for ${response.name}. Next poll in ${response.polling_interval_seconds}s.`);
        } catch {
          setStatus("Could not update location. Check badge ID or network.");
        }
      },
      () => setStatus("Could not read GPS location."),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <section className="ops-surface border-b border-slate-800 px-5 py-8 text-white md:px-10">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-300">
          <Radio className="h-4 w-4" />
          Field location polling
        </div>
        <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">
          Share live badge location with the deployment desk.
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
          This page shares GPS every 30 seconds while active, so Command Centre can assign the nearest available officer.
        </p>
      </section>

      <section className="mx-auto grid max-w-5xl gap-5 px-5 py-8 md:grid-cols-[minmax(0,1fr)_360px]">
        <div className="light-card p-5">
          <label className="text-sm font-medium text-slate-700">
            Badge ID
            <input
              className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              disabled={isPolling}
              onChange={(event) => setBadgeId(event.target.value)}
              placeholder="BTP-1234"
              value={badgeId}
            />
          </label>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-orange-600 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60"
              disabled={isPolling}
              onClick={startPolling}
              type="button"
            >
              {isPolling ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
              Start polling
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              onClick={stopPolling}
              type="button"
            >
              <Square className="h-4 w-4" />
              Stop
            </button>
          </div>

          <div className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            {status}
            {lastSeen ? (
              <div className="mt-2 font-mono text-xs text-slate-500">Last update: {formatDateTime(lastSeen)}</div>
            ) : null}
          </div>
        </div>

        <aside className="control-card p-5 text-slate-100">
          <div className="font-semibold">Ground instructions</div>
          <div className="mt-4 space-y-3 text-sm leading-6 text-slate-300">
            <p>Use the same badge ID registered by Command Centre.</p>
            <p>Keep this tab open during duty if you are not using the logged-in field dashboard.</p>
            <p>Stop polling when duty ends or the device changes hands.</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
