"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Crosshair,
  Loader2,
  MapPin,
  Radio,
  Send,
  ShieldAlert,
  Siren,
  Wifi,
} from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import {
  bengaluruCorridors,
  bengaluruZones,
  complaintTypeDescriptions,
  complaintTypeLabels,
  highSignalLocations,
} from "@/lib/bengaluru";
import { submitCitizenGrievance } from "@/lib/api";
import type {
  CitizenGrievance,
  CitizenGrievancePayload,
  GrievanceType,
} from "@/types/prediction";

type FormState = {
  reporter_name: string;
  reporter_phone: string;
  reporter_email: string;
  complaint_type: GrievanceType;
  location_text: string;
  zone: string;
  corridor: string;
  latitude: string;
  longitude: string;
  description: string;
};

type FormErrors = Partial<Record<keyof FormState | "contact", string>>;

const initialFormState: FormState = {
  reporter_name: "",
  reporter_phone: "",
  reporter_email: "",
  complaint_type: "event_congestion",
  location_text: "",
  zone: "",
  corridor: "",
  latitude: "",
  longitude: "",
  description: "",
};

const SEVERITY_CONFIG = {
  Critical: { color: "text-[#e05252]", bg: "bg-[#e05252]/15", border: "border-[#e05252]/40" },
  High:     { color: "text-[#e8a034]", bg: "bg-[#e8a034]/15", border: "border-[#e8a034]/40" },
  Medium:   { color: "text-[#4e8fe8]", bg: "bg-[#4e8fe8]/15", border: "border-[#4e8fe8]/40" },
  Low:      { color: "text-[#35b779]", bg: "bg-[#35b779]/15", border: "border-[#35b779]/40" },
};

export default function CitizenGrievancePage() {
  const [formData, setFormData] = useState<FormState>(initialFormState);
  const [errors, setErrors] = useState<FormErrors>({});
  const [result, setResult] = useState<CitizenGrievance | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  const completion = useMemo(() => {
    const required: Array<keyof FormState> = [
      "complaint_type",
      "location_text",
      "zone",
      "corridor",
      "description",
    ];
    const done = required.filter((f) => String(formData[f]).trim()).length;
    const hasContact = Boolean(formData.reporter_phone.trim());
    const hasCoords  = Boolean(formData.latitude.trim()) && Boolean(formData.longitude.trim());
    return Math.round(((done + Number(hasContact) + Number(hasCoords)) / (required.length + 2)) * 100);
  }, [formData]);

  function update<K extends keyof FormState>(field: K, value: FormState[K]) {
    setFormData((c) => ({ ...c, [field]: value }));
    setErrors((c) => ({ ...c, [field]: undefined, contact: undefined }));
  }

  function applyPreset(preset: (typeof highSignalLocations)[number]) {
    setFormData((c) => ({
      ...c,
      location_text: preset.label,
      zone:      preset.zone,
      corridor:  preset.corridor,
      latitude:  String(preset.latitude),
      longitude: String(preset.longitude),
    }));
    setErrors({});
    setLocationMessage(`Pinned — ${preset.label}`);
  }

  function captureGps() {
    setLocationMessage("");
    if (!navigator.geolocation) {
      setLocationMessage("Geolocation not supported in this browser.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFormData((c) => ({
          ...c,
          latitude:  pos.coords.latitude.toFixed(6),
          longitude: pos.coords.longitude.toFixed(6),
        }));
        setLocationMessage("GPS acquired. Add nearest junction name.");
        setIsLocating(false);
      },
      () => {
        setLocationMessage("GPS unavailable. Enter location manually.");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 10_000 }
    );
  }

  function validate(): FormErrors {
    const e: FormErrors = {};
    if (!formData.reporter_phone.trim())
      e.contact = "WhatsApp number required for complaint tracking.";
    if (!formData.location_text.trim())
      e.location_text = "Nearest junction or landmark required.";
    if (!formData.zone.trim())
      e.zone = "BTP zone required.";
    if (!formData.corridor.trim())
      e.corridor = "Affected corridor required.";
    if (!formData.description.trim())
      e.description = "Describe what is happening.";
    else if (formData.description.trim().length < 20)
      e.description = "At least 20 characters needed for triage.";
    if (formData.latitude && Number.isNaN(Number(formData.latitude)))
      e.latitude = "Must be a number.";
    if (formData.longitude && Number.isNaN(Number(formData.longitude)))
      e.longitude = "Must be a number.";
    return e;
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMessage("");
    setResult(null);
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length) {
      setErrorMessage("Complete the highlighted fields before submitting.");
      return;
    }
    setIsSubmitting(true);
    const payload: CitizenGrievancePayload = {
      reporter_name:  formData.reporter_name || undefined,
      reporter_phone: formData.reporter_phone || undefined,
      reporter_email: formData.reporter_email || undefined,
      complaint_type: formData.complaint_type,
      location_text:  formData.location_text.trim(),
      zone:           formData.zone.trim(),
      corridor:       formData.corridor.trim(),
      latitude:       formData.latitude  ? Number(formData.latitude)  : undefined,
      longitude:      formData.longitude ? Number(formData.longitude) : undefined,
      description:    formData.description.trim(),
    };
    try {
      const response = await submitCitizenGrievance(payload);
      setResult(response);
      setFormData(initialFormState);
      setErrors({});
      setLocationMessage("");
    } catch {
      setErrorMessage("Submission failed. Police intake may be temporarily unavailable.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const sevConfig = result
    ? (SEVERITY_CONFIG[result.severity as keyof typeof SEVERITY_CONFIG] ?? SEVERITY_CONFIG.Low)
    : null;

  return (
    <div className="min-h-screen bg-[#0a0c0f] text-[#dce2ea]">
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#252b35] bg-[#0a0c0f]/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded border border-[#252b35] bg-[#141820]">
              <Radio className="h-4 w-4 text-[#e8a034]" />
            </div>
            <div>
              <div className="font-mono text-[12px] font-bold tracking-widest text-[#e8a034]">DRISHTI</div>
              <div className="mono-id leading-none text-[#707987]">Citizen Incident Portal</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              className="px-3 py-2 text-[12px] text-[#9ba5b3] transition hover:text-[#f5f7fb]"
              href="/citizen/track"
            >
              Track Complaint
            </Link>
            <Link
              className="inline-flex items-center gap-2 rounded border border-[#252b35] bg-[#141820] px-4 py-2 text-[12px] font-semibold text-[#dce2ea] transition hover:bg-[#1a1f28]"
              href="/login"
            >
              Police Login
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <div className="ops-surface border-b border-[#252b35] px-5 py-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#e8a034]/30 bg-[#e8a034]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#e8a034]">
                <Siren className="h-3 w-3" />
                Bengaluru Traffic Police · Public Intake
              </div>
              <h1 className="mt-5 text-[32px] font-bold leading-tight text-[#f5f7fb] md:text-[40px]">
                Report a traffic incident<br />
                <span className="text-[#e8a034]">to Bengaluru Police</span>
              </h1>
              <p className="mt-4 max-w-xl text-[14px] leading-7 text-[#9ba5b3]">
                Your report enters the police dispatch queue immediately. DRISHTI AI
                auto-assesses severity and routes it to the nearest available officer.
                No login required.
              </p>
            </div>

            {/* Completion gauge */}
            <div className="command-panel p-5">
              <div className="flex items-center justify-between">
                <div className="section-kicker text-[#e8a034]">Intake completeness</div>
                <div className={`mono-id rounded px-2 py-0.5 text-[10px] ${
                  completion >= 90
                    ? "bg-[#35b779]/15 text-[#35b779]"
                    : "bg-[#e8a034]/15 text-[#e8a034]"
                }`}>
                  {completion >= 90 ? "READY TO SEND" : "NEEDS DETAILS"}
                </div>
              </div>
              <div className="mt-4 flex items-end gap-4">
                <div className="font-mono text-[48px] font-bold leading-none text-[#f5f7fb]">
                  {completion}
                  <span className="text-[20px] text-[#9ba5b3]">%</span>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#252b35]">
                <div
                  className="data-bar h-full rounded-full bg-[#e8a034] transition-all duration-500"
                  style={{ ["--bar-pct" as string]: `${completion}%` }}
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {(["complaint_type", "location_text", "zone", "corridor", "description"] as const).map((f) => (
                  <div
                    className={`flex items-center gap-1.5 text-[11px] ${
                      String(formData[f]).trim() ? "text-[#35b779]" : "text-[#505866]"
                    }`}
                    key={f}
                  >
                    <span className={`h-1 w-1 rounded-full ${String(formData[f]).trim() ? "bg-[#35b779]" : "bg-[#505866]"}`} />
                    {f.replace(/_/g, " ")}
                  </div>
                ))}
                <div className={`flex items-center gap-1.5 text-[11px] ${formData.reporter_phone.trim() ? "text-[#35b779]" : "text-[#505866]"}`}>
                  <span className={`h-1 w-1 rounded-full ${formData.reporter_phone.trim() ? "bg-[#35b779]" : "bg-[#505866]"}`} />
                  phone (whatsapp)
                </div>
                <div className={`flex items-center gap-1.5 text-[11px] ${formData.latitude && formData.longitude ? "text-[#35b779]" : "text-[#505866]"}`}>
                  <span className={`h-1 w-1 rounded-full ${formData.latitude && formData.longitude ? "bg-[#35b779]" : "bg-[#505866]"}`} />
                  gps coordinates
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">

          {/* ── Form ─────────────────────────────────────────────────────────── */}
          <form className="space-y-5" onSubmit={handleSubmit}>

            {/* Location quick-set */}
            <div className="command-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="panel-title">
                    <MapPin className="h-3.5 w-3.5 text-[#e8a034]" />
                    Location
                  </div>
                  <div className="mt-1 text-[12px] text-[#707987]">
                    Tap a hotspot or use GPS to prefill location fields
                  </div>
                </div>
                <button
                  className="inline-flex items-center gap-2 rounded border border-[#252b35] bg-[#10141b] px-3 py-2 text-[12px] font-semibold text-[#dce2ea] transition hover:border-[#e8a034]/40 hover:text-[#e8a034] disabled:opacity-50"
                  disabled={isLocating}
                  onClick={captureGps}
                  type="button"
                >
                  {isLocating ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Crosshair className="h-3.5 w-3.5" />
                  )}
                  {isLocating ? "Acquiring…" : "Use GPS"}
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {highSignalLocations.map((preset) => (
                  <button
                    className="rounded border border-[#252b35] bg-[#10141b] px-3 py-1.5 text-[11px] font-medium text-[#9ba5b3] transition hover:border-[#e8a034]/40 hover:text-[#e8a034]"
                    key={preset.label}
                    onClick={() => applyPreset(preset)}
                    type="button"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {locationMessage ? (
                <div className="mt-3 flex items-center gap-2 text-[12px] text-[#19b7a5]">
                  <Wifi className="h-3.5 w-3.5" />
                  {locationMessage}
                </div>
              ) : null}
            </div>

            {/* Core fields */}
            <div className="command-panel p-5">
              <div className="panel-title mb-5">
                <ShieldAlert className="h-3.5 w-3.5 text-[#e8a034]" />
                Incident Details
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DarkField label="Complaint type" required>
                  <select
                    className={darkSelect}
                    title="Complaint type"
                    value={formData.complaint_type}
                    onChange={(e) => update("complaint_type", e.target.value as GrievanceType)}
                  >
                    {Object.entries(complaintTypeLabels).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                </DarkField>

                <DarkField error={errors.location_text} label="Nearest junction / landmark" required>
                  <input
                    className={darkInput}
                    placeholder="e.g. Trinity Circle, MG Road"
                    value={formData.location_text}
                    onChange={(e) => update("location_text", e.target.value)}
                  />
                </DarkField>

                <DarkField error={errors.zone} label="BTP zone" required>
                  <select
                    className={darkSelect}
                    title="BTP zone"
                    value={formData.zone}
                    onChange={(e) => update("zone", e.target.value)}
                  >
                    <option value="">Select zone</option>
                    {bengaluruZones.map((z) => <option key={z} value={z}>{z}</option>)}
                  </select>
                </DarkField>

                <DarkField error={errors.corridor} label="Affected corridor" required>
                  <select
                    className={darkSelect}
                    title="Affected corridor"
                    value={formData.corridor}
                    onChange={(e) => update("corridor", e.target.value)}
                  >
                    <option value="">Select corridor</option>
                    {bengaluruCorridors.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </DarkField>

                <DarkField error={errors.contact} label="WhatsApp phone" required>
                  <input
                    className={darkInput}
                    placeholder="9876543210"
                    value={formData.reporter_phone}
                    onChange={(e) => update("reporter_phone", e.target.value)}
                  />
                </DarkField>

                <DarkField label="Reporter name">
                  <input
                    className={darkInput}
                    placeholder="Optional"
                    value={formData.reporter_name}
                    onChange={(e) => update("reporter_name", e.target.value)}
                  />
                </DarkField>

                <DarkField error={errors.latitude} label="Latitude">
                  <input
                    className={darkInput}
                    placeholder="Auto-filled by GPS"
                    step="any"
                    type="number"
                    value={formData.latitude}
                    onChange={(e) => update("latitude", e.target.value)}
                  />
                </DarkField>

                <DarkField error={errors.longitude} label="Longitude">
                  <input
                    className={darkInput}
                    placeholder="Auto-filled by GPS"
                    step="any"
                    type="number"
                    value={formData.longitude}
                    onChange={(e) => update("longitude", e.target.value)}
                  />
                </DarkField>
              </div>

              <div className="mt-4">
                <DarkField
                  error={errors.description}
                  hint="Describe what is blocked, how long, and whether emergency vehicles are affected."
                  label="Description"
                  required
                >
                  <textarea
                    className={`${darkInput} min-h-[120px] resize-y`}
                    placeholder="e.g. Large gathering near Trinity Circle has blocked the left turn. Buses are stuck and traffic backing up toward MG Road."
                    value={formData.description}
                    onChange={(e) => update("description", e.target.value)}
                  />
                </DarkField>
              </div>

              {errorMessage ? (
                <div className="mt-4 flex items-center gap-2 rounded border border-[#e05252]/40 bg-[#e05252]/10 px-4 py-3 text-[13px] text-[#e05252]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {errorMessage}
                </div>
              ) : null}

              <button
                className="mt-5 inline-flex items-center gap-2 rounded bg-[#e8a034] px-5 py-2.5 text-[13px] font-semibold text-[#0a0c0f] transition hover:bg-[#f0b75d] disabled:opacity-60"
                disabled={isSubmitting}
                type="submit"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                {isSubmitting ? "Transmitting…" : "Submit to police"}
              </button>
            </div>
          </form>

          {/* ── Sidebar ──────────────────────────────────────────────────────── */}
          <div className="space-y-5">

            {/* Incident type context */}
            <div className="command-panel p-5">
              <div className="panel-title mb-4">
                <ShieldAlert className="h-3.5 w-3.5 text-[#e8a034]" />
                Incident signal preview
              </div>
              <div className="space-y-3">
                <PreviewRow
                  label="Type"
                  value={complaintTypeLabels[formData.complaint_type]}
                  accent="text-[#e8a034]"
                />
                <PreviewRow
                  label="Context"
                  value={complaintTypeDescriptions[formData.complaint_type]}
                  accent="text-[#9ba5b3]"
                />
                <PreviewRow
                  label="Severity"
                  value="Auto-assessed by DRISHTI ML model on submission"
                  accent="text-[#19b7a5]"
                />
                <PreviewRow
                  label="Zone / Corridor"
                  value={[formData.zone, formData.corridor].filter(Boolean).join(" / ") || "Not yet selected"}
                  accent="text-[#9ba5b3]"
                />
                {formData.latitude && formData.longitude ? (
                  <PreviewRow
                    label="Coordinates"
                    value={`${Number(formData.latitude).toFixed(5)}, ${Number(formData.longitude).toFixed(5)}`}
                    accent="text-[#35b779]"
                  />
                ) : (
                  <PreviewRow
                    label="Coordinates"
                    value="GPS not captured — geocoded from location name"
                    accent="text-[#505866]"
                  />
                )}
              </div>
            </div>

            {/* Confirmed submission */}
            {result ? (
              <div className={`command-panel border ${sevConfig?.border ?? ""} p-5`}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-[#35b779]" />
                  <div className="text-[14px] font-semibold text-[#f5f7fb]">Complaint received</div>
                </div>

                <div className="mt-4 rounded border border-[#252b35] bg-[#10141b] p-3">
                  <div className="section-kicker mb-1">Tracking token</div>
                  <div className="font-mono text-[18px] font-bold text-[#e8a034]">{result.tracking_id}</div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded border border-[#252b35] bg-[#10141b] p-3">
                    <div className="section-kicker mb-1">AI severity</div>
                    <div className={`font-semibold ${sevConfig?.color ?? ""}`}>{result.severity}</div>
                  </div>
                  <div className="rounded border border-[#252b35] bg-[#10141b] p-3">
                    <div className="section-kicker mb-1">Status</div>
                    <div className="text-[12px] font-semibold text-[#f5f7fb]">{result.status}</div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <a
                    className="inline-flex items-center justify-center gap-2 rounded bg-[#35b779] px-4 py-2 text-[12px] font-semibold text-[#0a0c0f] transition hover:bg-[#3ecf8e]"
                    href={`https://wa.me/?text=${encodeURIComponent(
                      `DRISHTI complaint registered. Token: ${result.tracking_id}. Track: http://localhost:3000/citizen/track?token=${result.tracking_id}`
                    )}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Share on WhatsApp
                  </a>
                  <Link
                    className="inline-flex items-center justify-center gap-2 rounded border border-[#252b35] px-4 py-2 text-[12px] font-semibold text-[#dce2ea] transition hover:bg-[#141820]"
                    href={`/citizen/track?token=${encodeURIComponent(result.tracking_id)}`}
                  >
                    Track this complaint
                  </Link>
                </div>
              </div>
            ) : null}

            {/* What happens next */}
            <div className="command-panel p-5">
              <div className="panel-title mb-4">
                <Radio className="h-3.5 w-3.5 text-[#e8a034]" />
                What happens next
              </div>
              <div className="space-y-3">
                {[
                  { n: "01", t: "Queue entry", d: "Complaint enters the police dispatch queue with a unique tracking token." },
                  { n: "02", t: "AI triage",   d: "DRISHTI ML model scores severity and generates a dispatch recommendation." },
                  { n: "03", t: "Field deploy", d: "Command Centre links to nearest officer and issues a duty order." },
                ].map((step) => (
                  <div className="flex items-start gap-3" key={step.n}>
                    <div className="mono-id mt-0.5 shrink-0 text-[#e8a034]">{step.n}</div>
                    <div>
                      <div className="text-[12px] font-semibold text-[#f5f7fb]">{step.t}</div>
                      <div className="mt-0.5 text-[11px] text-[#707987]">{step.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dark-themed form primitives ───────────────────────────────────────────────
const darkInput =
  "w-full rounded border border-[#252b35] bg-[#10141b] px-3 py-2 text-[13px] text-[#dce2ea] placeholder-[#505866] outline-none focus:border-[#e8a034]/50 focus:ring-1 focus:ring-[#e8a034]/20 transition";

const darkSelect =
  "w-full rounded border border-[#252b35] bg-[#10141b] px-3 py-2 text-[13px] text-[#dce2ea] outline-none focus:border-[#e8a034]/50 focus:ring-1 focus:ring-[#e8a034]/20 transition";

function DarkField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1 text-[12px] font-medium text-[#9ba5b3]">
        {label}
        {required && <span className="text-[#e8a034]">*</span>}
      </label>
      {children}
      {error ? (
        <div className="mt-1 text-[11px] text-[#e05252]">{error}</div>
      ) : hint ? (
        <div className="mt-1 text-[11px] text-[#505866]">{hint}</div>
      ) : null}
    </div>
  );
}

function PreviewRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="border-b border-[#1e2430] pb-2.5 last:border-0 last:pb-0">
      <div className="section-kicker mb-1">{label}</div>
      <div className={`text-[12px] ${accent ?? "text-[#dce2ea]"}`}>{value}</div>
    </div>
  );
}

