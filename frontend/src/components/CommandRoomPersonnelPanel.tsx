"use client";

import { Loader2, UserPlus, Users, X } from "lucide-react";
import { useEffect, useState } from "react";

import { createPersonnel, listPersonnel, removePersonnel } from "@/lib/api";
import type { PolicePersonnel, PolicePersonnelPayload } from "@/types/prediction";

const RANKS: PolicePersonnelPayload["rank"][] = [
  "Constable", "Head Constable", "ASI", "SI", "Inspector", "ACP", "DCP",
];

const AVAIL_COLOR = {
  true:  { dot: "bg-[#10b981]", badge: "bg-[#10b981]/15 text-[#10b981]", label: "Available" },
  false: { dot: "bg-[#f59e0b]", badge: "bg-[#f59e0b]/15 text-[#f59e0b]", label: "Assigned"  },
};

export default function CommandRoomPersonnelPanel() {
  const [personnel, setPersonnel] = useState<PolicePersonnel[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSaving,  setIsSaving]    = useState(false);
  const [message,   setMessage]     = useState<{ text: string; ok: boolean } | null>(null);

  const [form, setForm] = useState({
    badge_id:          "",
    name:              "",
    rank:              "Constable" as PolicePersonnelPayload["rank"],
    unit_name:         "BTP East Division",
    zone:              "East Zone 1",
    whatsapp_phone:    "",
    current_latitude:  "12.9716",
    current_longitude: "77.5946",
  });

  async function load() {
    setIsLoading(true);
    try { setPersonnel(await listPersonnel()); } catch { /* silent */ }
    setIsLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.badge_id.trim() || !form.name.trim()) {
      setMessage({ text: "Badge ID and name are required.", ok: false });
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      await createPersonnel({
        badge_id:          form.badge_id.trim(),
        name:              form.name.trim(),
        rank:              form.rank,
        unit_name:         form.unit_name.trim(),
        zone:              form.zone.trim(),
        whatsapp_phone:    form.whatsapp_phone.trim() || undefined,
        current_latitude:  form.current_latitude  ? Number(form.current_latitude)  : undefined,
        current_longitude: form.current_longitude ? Number(form.current_longitude) : undefined,
      });
      setMessage({ text: "Officer registered and ready for deployment.", ok: true });
      setForm((f) => ({ ...f, badge_id: "", name: "", whatsapp_phone: "" }));
      await load();
    } catch {
      setMessage({ text: "Registration failed. Check the badge ID is unique.", ok: false });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRemove(id: string) {
    try {
      await removePersonnel(id);
      setPersonnel((prev) => prev.filter((p) => p.id !== id));
    } catch { /* silent */ }
  }

  return (
    <div className="cmd-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#1c2e4a] px-5 py-4">
        <Users className="h-4 w-4 text-[#22d3ee]" />
        <div>
          <div className="panel-title">Personnel Registry</div>
          <p className="mt-0.5 text-[11px] text-[#3d5278]">
            Register field officers with badge, unit, zone, and GPS seed for deployment.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3 p-8 text-[12px] text-[#3d5278]">
          <Loader2 className="h-4 w-4 animate-spin" />Loading registry…
        </div>
      ) : (
        <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_380px]">

          {/* Officer cards */}
          <div>
            <div className="section-kicker mb-3 flex items-center gap-1.5">
              <Users className="h-3 w-3" />Registered deployment personnel
            </div>
            {personnel.length ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {personnel.slice(0, 10).map((item) => {
                  const av = AVAIL_COLOR[String(item.is_available) as "true" | "false"] ?? AVAIL_COLOR.false;
                  return (
                    <div className="cmd-card p-3.5" key={item.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-semibold text-[#f0f6ff]">{item.name}</div>
                          <div className="mono-id mt-0.5 truncate">
                            {item.badge_id} · {item.rank} · {item.unit_name}
                          </div>
                        </div>
                        <button
                          className="shrink-0 rounded-lg border border-[#ef4444]/25 p-1.5 text-[#ef4444]/60 transition hover:border-[#ef4444]/60 hover:text-[#ef4444]"
                          onClick={() => handleRemove(item.id)}
                          title="Remove officer"
                          type="button"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      <div className="mt-2.5 flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${av.dot}`} />
                        <span className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] ${av.badge}`}>
                          {av.label}
                        </span>
                        {item.zone && (
                          <span className="text-[10px] text-[#3d5278]">{item.zone}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#1c2e4a] p-8 text-center text-[12px] text-[#3d5278]">
                No personnel registered yet. Use the form to add badge-linked officers.
              </div>
            )}
          </div>

          {/* Registration form */}
          <aside className="rounded-xl border border-[#1c2e4a] bg-[#0d1629] p-5">
            <div className="section-kicker mb-4 flex items-center gap-1.5">
              <UserPlus className="h-3 w-3 text-[#22d3ee]" />Register police personnel
            </div>

            <div className="space-y-3">
              <DarkField
                label="Badge ID"
                onChange={(v) => setForm((f) => ({ ...f, badge_id: v }))}
                placeholder="e.g. BERT123"
                value={form.badge_id}
              />
              <DarkField
                label="Name"
                onChange={(v) => setForm((f) => ({ ...f, name: v }))}
                placeholder="Full name"
                value={form.name}
              />

              <div>
                <label className="section-kicker block mb-1.5" htmlFor="rank-select">Rank</label>
                <select
                  className="field-dark"
                  id="rank-select"
                  onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value as PolicePersonnelPayload["rank"] }))}
                  value={form.rank}
                >
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>

              <DarkField
                label="Unit"
                onChange={(v) => setForm((f) => ({ ...f, unit_name: v }))}
                value={form.unit_name}
              />
              <DarkField
                label="Zone"
                onChange={(v) => setForm((f) => ({ ...f, zone: v }))}
                value={form.zone}
              />
              <DarkField
                label="WhatsApp number"
                onChange={(v) => setForm((f) => ({ ...f, whatsapp_phone: v }))}
                placeholder="+91 9XXXXXXXXX"
                value={form.whatsapp_phone}
              />

              <div className="grid grid-cols-2 gap-3">
                <DarkField
                  label="Current lat"
                  onChange={(v) => setForm((f) => ({ ...f, current_latitude: v }))}
                  value={form.current_latitude}
                />
                <DarkField
                  label="Current lng"
                  onChange={(v) => setForm((f) => ({ ...f, current_longitude: v }))}
                  value={form.current_longitude}
                />
              </div>

              {message && (
                <div className={`rounded-xl border px-3 py-2 text-[11px] ${
                  message.ok
                    ? "border-[#10b981]/30 bg-[#10b981]/10 text-[#10b981]"
                    : "border-[#ef4444]/30 bg-[#ef4444]/10 text-[#ef4444]"
                }`}>
                  {message.text}
                </div>
              )}

              <button
                className="btn-primary w-full py-2.5 text-[12px]"
                disabled={isSaving}
                onClick={handleCreate}
                type="button"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                Register personnel
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function DarkField({
  label,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onChange: (v: string) => void;
  placeholder?: string;
  value: string;
}) {
  return (
    <div>
      <label className="section-kicker block mb-1.5">{label}</label>
      <input
        className="field-dark"
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        value={value}
      />
    </div>
  );
}
