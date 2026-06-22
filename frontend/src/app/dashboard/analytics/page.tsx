"use client";

import { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";

const API = process.env.NEXT_PUBLIC_API_URL || "https://gridathon-production.up.railway.app";

const TYPE_LABELS: Record<string, string> = {
  accident: "Accident",
  signal_failure: "Signal Failure",
  road_closure: "Road Closure",
  event_congestion: "Event Congestion",
  illegal_parking: "Illegal Parking",
  other: "Other",
};

interface Analytics {
  by_zone: { zone: string; total: number; critical: number; high: number; medium: number; low: number }[];
  by_type: { complaint_type: string; total: number }[];
  by_status: { status: string; total: number }[];
  by_hour: { hour: number; total: number }[];
  totals: { total: number; resolved: number; critical_count: number };
}

const STATUS_COLORS = ["#f59e0b", "#3b82f6", "#8b5cf6", "#22c55e", "#ef4444", "#6b7280"];

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token") || "";
    fetch(`${API}/police/analytics`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="text-[#f5c518] text-lg animate-pulse">Loading analytics...</div>
    </div>
  );

  if (!data) return (
    <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
      <div className="text-red-400">Failed to load analytics</div>
    </div>
  );

  const resolutionRate = data.totals.total
    ? Math.round((data.totals.resolved / data.totals.total) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6">
      <h1 className="text-2xl font-bold text-[#f5c518] mb-2">Analytics Dashboard</h1>
      <p className="text-gray-400 text-sm mb-6">Last 7 days · Bengaluru Traffic Operations</p>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Incidents", value: data.totals.total ?? 0, color: "text-white" },
          { label: "Resolved", value: data.totals.resolved ?? 0, color: "text-green-400" },
          { label: "Resolution Rate", value: `${resolutionRate}%`, color: "text-[#f5c518]" },
          { label: "Critical", value: data.totals.critical_count ?? 0, color: "text-red-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
            <div className={`text-3xl font-bold ${kpi.color}`}>{kpi.value}</div>
            <div className="text-gray-400 text-sm mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Incidents by Zone */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
          <h2 className="text-[#f5c518] font-semibold mb-4">Incidents by Zone</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.by_zone.filter(z => z.zone)} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="zone" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff" }} />
              <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 11 }} />
              <Bar dataKey="critical" stackId="a" fill="#ef4444" name="Critical" />
              <Bar dataKey="high" stackId="a" fill="#f97316" name="High" />
              <Bar dataKey="medium" stackId="a" fill="#eab308" name="Medium" />
              <Bar dataKey="low" stackId="a" fill="#22c55e" name="Low" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Incidents by Type */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
          <h2 className="text-[#f5c518] font-semibold mb-4">Incident Types</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={data.by_type.map(t => ({ ...t, name: TYPE_LABELS[t.complaint_type] || t.complaint_type }))}
                dataKey="total"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                labelLine={{ stroke: "#4b5563" }}
              >
                {data.by_type.map((_, i) => (
                  <Cell key={i} fill={STATUS_COLORS[i % STATUS_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Hourly distribution */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
          <h2 className="text-[#f5c518] font-semibold mb-4">Incidents by Hour (IST)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data.by_hour} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis dataKey="hour" tick={{ fill: "#9ca3af", fontSize: 11 }}
                tickFormatter={(h) => `${h}:00`} />
              <YAxis tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff" }}
                labelFormatter={(h) => `${h}:00 IST`}
              />
              <Line type="monotone" dataKey="total" stroke="#f5c518" strokeWidth={2} dot={false} name="Incidents" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Status breakdown */}
        <div className="bg-[#1a1a1a] rounded-xl p-4 border border-[#2a2a2a]">
          <h2 className="text-[#f5c518] font-semibold mb-4">Status Breakdown</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.by_status} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" />
              <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} />
              <YAxis type="category" dataKey="status" tick={{ fill: "#9ca3af", fontSize: 11 }} width={90} />
              <Tooltip contentStyle={{ background: "#1a1a1a", border: "1px solid #2a2a2a", color: "#fff" }} />
              <Bar dataKey="total" fill="#f5c518" radius={[0, 4, 4, 0]} name="Count" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
