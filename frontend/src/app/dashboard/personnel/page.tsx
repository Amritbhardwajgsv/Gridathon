"use client";

import { MapPinned, Phone, Radio, RefreshCw, Shield, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import CommandRoomPersonnelPanel from "@/components/CommandRoomPersonnelPanel";
import ProtectedRoute from "@/components/ProtectedRoute";
import { listPersonnel } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { PolicePersonnel } from "@/types/prediction";

export default function PersonnelPage() {
  const [personnel, setPersonnel] = useState<PolicePersonnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function loadPersonnel() {
    setIsLoading(true);
    try { setPersonnel(await listPersonnel()); }
    catch { /* silent */ }
    finally { setIsLoading(false); }
  }

  useEffect(() => { loadPersonnel(); }, []);

  const summary = useMemo(() => ({
    total:       personnel.length,
    active:      personnel.filter((p) => p.is_active !== false).length,
    available:   personnel.filter((p) => p.is_available).length,
    withLocation: personnel.filter((p) => p.current_latitude && p.current_longitude).length,
  }), [personnel]);

  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="section-kicker flex items-center gap-2 text-[#22d3ee]">
              <Radio className="h-3.5 w-3.5" />Personnel Registry
            </div>
            <h1 className="page-title mt-1">Badge-linked deployment personnel</h1>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-xl border border-[#1c2e4a] bg-[#0d1629] px-3 py-2 text-[12px] text-[#dde8f5] transition hover:bg-[#111f38] disabled:opacity-60"
            disabled={isLoading}
            onClick={loadPersonnel}
            type="button"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid gap-3 md:grid-cols-4">
          <KpiCard icon={Users}     label="Total"          topColor="border-t-[#22d3ee]" iconColor="text-[#22d3ee]" value={summary.total} />
          <KpiCard icon={Shield}    label="Active"         topColor="border-t-[#10b981]" iconColor="text-[#10b981]" value={summary.active} />
          <KpiCard icon={Radio}     label="Available now"  topColor="border-t-[#3b82f6]" iconColor="text-[#3b82f6]" value={summary.available} />
          <KpiCard icon={MapPinned} label="GPS live"       topColor="border-t-[#a78bfa]" iconColor="text-[#a78bfa]" value={summary.withLocation} />
        </div>

        {/* Register + cards panel */}
        <CommandRoomPersonnelPanel />

        {/* Full registry table */}
        <div className="cmd-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#1c2e4a] px-5 py-4">
            <Users className="h-3.5 w-3.5 text-[#22d3ee]" />
            <div className="panel-title">Registered personnel</div>
          </div>

          {isLoading ? (
            <div className="p-8 text-[12px] text-[#3d5278]">Loading personnel registry…</div>
          ) : personnel.length ? (
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px]">
                <thead>
                  <tr className="border-b border-[#1c2e4a] bg-[#0d1629]">
                    {["Officer", "Badge", "Unit", "Contact", "Location", "Status"].map((h) => (
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-[0.12em] text-[#3d5278]" key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1c2e4a]">
                  {personnel.map((item) => (
                    <tr className="hover:bg-[#0d1629]/50 transition" key={item.id}>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-[#f0f6ff]">{item.name}</div>
                        <div className="mono-id mt-0.5">{item.rank}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="mono-id text-[#22d3ee]">{item.badge_id}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-[#dde8f5]">{item.unit_name}</div>
                        <div className="mono-id mt-0.5">{item.zone || "Zone pending"}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-[#7c9ab8]">
                          <Phone className="h-3 w-3 shrink-0 text-[#3d5278]" />
                          {item.whatsapp_phone || item.phone || "Not provided"}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {item.current_latitude && item.current_longitude ? (
                          <div>
                            <div className="font-mono text-[11px] text-[#dde8f5]">
                              {item.current_latitude.toFixed(4)}, {item.current_longitude.toFixed(4)}
                            </div>
                            <div className="mono-id mt-0.5">
                              {item.last_location_at ? formatDateTime(item.last_location_at) : "Time pending"}
                            </div>
                          </div>
                        ) : (
                          <span className="text-[#3d5278]">No location</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em] ${
                          item.is_available
                            ? "bg-[#10b981]/15 text-[#10b981]"
                            : "bg-[#f59e0b]/15 text-[#f59e0b]"
                        }`}>
                          {item.is_available ? "Available" : "Assigned"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-[12px] text-[#3d5278]">
              No personnel registered yet. Use the panel above to add badge-linked officers.
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}

function KpiCard({
  icon: Icon,
  iconColor,
  label,
  topColor,
  value,
}: {
  icon: typeof Users;
  iconColor: string;
  label: string;
  topColor: string;
  value: number;
}) {
  return (
    <div className={`cmd-card border-t-2 p-4 ${topColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className="section-kicker">{label}</div>
          <div className="mt-2 font-mono text-[28px] font-bold text-[#f0f6ff]">{value}</div>
        </div>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
    </div>
  );
}
