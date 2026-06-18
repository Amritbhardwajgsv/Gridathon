"use client";

import axios from "axios";
import { Loader2, Send } from "lucide-react";
import { FormEvent, useState } from "react";

import { predictImpact } from "@/lib/api";
import { savePredictionHistoryItem } from "@/lib/auth";
import type {
  PredictImpactPayload,
  PredictImpactResponse
} from "@/types/prediction";

interface PredictionFormProps {
  onPrediction: (result: PredictImpactResponse, payload: PredictImpactPayload) => void;
  overrides?: Partial<Record<keyof FormState, string>>;
}

type FormState = Record<
  | "event_name"
  | "event_cause_grouped"
  | "event_type"
  | "priority"
  | "requires_road_closure"
  | "corridor"
  | "zone"
  | "latitude"
  | "longitude"
  | "hour"
  | "day_of_week"
  | "month"
  | "estimated_crowd_size"
  | "operational_description"
  | "operator_override_notes"
  | "idempotency_key",
  string
>;

const initialFormState: FormState = {
  event_name: "High crowd movement near stadium gate",
  event_cause_grouped: "political_rally",
  event_type: "unplanned",
  priority: "High",
  requires_road_closure: "false",
  corridor: "ORR East 1",
  zone: "East Zone 1",
  latitude: "12.9716",
  longitude: "77.5946",
  hour: "9",
  day_of_week: "2",
  month: "6",
  estimated_crowd_size: "25000",
  operational_description:
    "Crowd is expected to spill onto the service road with buses, autos, and pedestrian movement near the junction. Keep diversion and barricading ready.",
  operator_override_notes: "",
  idempotency_key: ""
};

const inputClassName =
  "mt-1 w-full rounded border border-line bg-white px-3 py-2 text-sm text-ink-900 outline-none transition focus:border-pine focus:ring-2 focus:ring-pine/15";

export default function PredictionForm({ onPrediction, overrides }: PredictionFormProps) {
  const [formData, setFormData] = useState<FormState>({ ...initialFormState, ...overrides });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  function updateField(field: keyof FormState, value: string) {
    setFormData((current) => ({ ...current, [field]: value }));
  }

  function buildPayload(): PredictImpactPayload {
    const payload: PredictImpactPayload = {
      event_name: formData.event_name.trim() || undefined,
      event_cause_grouped: formData.event_cause_grouped,
      event_type: formData.event_type,
      pipeline_mode: formData.event_type === "planned" ? "planned" : "unplanned",
      priority: formData.priority,
      requires_road_closure: formData.requires_road_closure === "true",
      corridor: formData.corridor,
      zone: formData.zone,
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      hour: Number(formData.hour),
      day_of_week: Number(formData.day_of_week),
      month: Number(formData.month),
      operational_description: formData.operational_description.trim(),
      operator_override_notes:
        formData.operator_override_notes.trim() || undefined,
      idempotency_key: formData.idempotency_key.trim() || undefined
    };

    if (formData.estimated_crowd_size.trim()) {
      payload.estimated_crowd_size = Number(formData.estimated_crowd_size);
    }

    return payload;
  }

  function validatePayload(payload: PredictImpactPayload): string | null {
    const requiredStrings = [
      ["Cause group", payload.event_cause_grouped],
      ["Event type", payload.event_type],
      ["Priority", payload.priority],
      ["Corridor", payload.corridor],
      ["Zone", payload.zone],
      ["Operational description", payload.operational_description]
    ];

    for (const [label, value] of requiredStrings) {
      if (!String(value).trim()) {
        return `${label} is required.`;
      }
    }

    const numericFields = [
      ["Latitude", payload.latitude],
      ["Longitude", payload.longitude],
      ["Hour", payload.hour],
      ["Day of week", payload.day_of_week],
      ["Month", payload.month],
      ["Estimated crowd", payload.estimated_crowd_size ?? 0]
    ];

    for (const [label, value] of numericFields) {
      if (Number.isNaN(Number(value))) {
        return `${label} must be a valid number.`;
      }
    }

    if (payload.hour < 0 || payload.hour > 23) {
      return "Hour must be between 0 and 23.";
    }
    if (payload.day_of_week < 0 || payload.day_of_week > 6) {
      return "Day of week must be between 0 and 6.";
    }
    if (payload.month < 1 || payload.month > 12) {
      return "Month must be between 1 and 12.";
    }

    return null;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsLoading(true);

    const payload = buildPayload();
    const validationMessage = validatePayload(payload);

    if (validationMessage) {
      setErrorMessage(validationMessage);
      setIsLoading(false);
      return;
    }

    try {
      const result = await predictImpact(payload);
      savePredictionHistoryItem({
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        payload,
        result
      });
      onPrediction(result, payload);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const detail = error.response?.data?.detail;
        setErrorMessage(
          typeof detail === "string"
            ? detail
            : "Forecast request failed. Check police system connectivity and login access."
        );
      } else {
        setErrorMessage("Prediction failed. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form
      className="rounded-md border border-line bg-white p-5 shadow-soft"
      onSubmit={handleSubmit}
    >
      <div className="mb-5 border-b border-line pb-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
          Event intake
        </div>
        <h2 className="mt-1 text-lg font-semibold text-ink-950">
          Traffic forecast request
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-ink-700 md:col-span-2">
          Event name
          <input
            className={inputClassName}
            onChange={(event) => updateField("event_name", event.target.value)}
            required
            value={formData.event_name}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Cause group
          <select
            className={inputClassName}
            onChange={(event) =>
              updateField("event_cause_grouped", event.target.value)
            }
            value={formData.event_cause_grouped}
          >
            <option value="political_rally">Political rally</option>
            <option value="festival">Festival</option>
            <option value="sports_event">Sports event</option>
            <option value="construction_activity">Construction activity</option>
            <option value="sudden_gathering">Sudden gathering</option>
            <option value="vehicle_breakdown">Vehicle breakdown</option>
          </select>
        </label>

        <label className="text-sm font-medium text-ink-700">
          Event type
          <select
            className={inputClassName}
            onChange={(event) => updateField("event_type", event.target.value)}
            value={formData.event_type}
          >
            <option value="unplanned">Unplanned</option>
            <option value="planned">Planned</option>
          </select>
        </label>

        <label className="text-sm font-medium text-ink-700">
          Priority
          <select
            className={inputClassName}
            onChange={(event) => updateField("priority", event.target.value)}
            value={formData.priority}
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Critical">Critical</option>
          </select>
        </label>

        <label className="text-sm font-medium text-ink-700">
          Road closure
          <select
            className={inputClassName}
            onChange={(event) =>
              updateField("requires_road_closure", event.target.value)
            }
            value={formData.requires_road_closure}
          >
            <option value="false">No</option>
            <option value="true">Yes</option>
          </select>
        </label>

        <label className="text-sm font-medium text-ink-700">
          Corridor
          <input
            className={inputClassName}
            onChange={(event) => updateField("corridor", event.target.value)}
            required
            value={formData.corridor}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Zone
          <input
            className={inputClassName}
            onChange={(event) => updateField("zone", event.target.value)}
            required
            value={formData.zone}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Latitude
          <input
            className={inputClassName}
            onChange={(event) => updateField("latitude", event.target.value)}
            required
            step="any"
            type="number"
            value={formData.latitude}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Longitude
          <input
            className={inputClassName}
            onChange={(event) => updateField("longitude", event.target.value)}
            required
            step="any"
            type="number"
            value={formData.longitude}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Hour
          <input
            className={inputClassName}
            max={23}
            min={0}
            onChange={(event) => updateField("hour", event.target.value)}
            required
            type="number"
            value={formData.hour}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Day of week
          <input
            className={inputClassName}
            max={6}
            min={0}
            onChange={(event) => updateField("day_of_week", event.target.value)}
            required
            type="number"
            value={formData.day_of_week}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Month
          <input
            className={inputClassName}
            max={12}
            min={1}
            onChange={(event) => updateField("month", event.target.value)}
            required
            type="number"
            value={formData.month}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Estimated crowd
          <input
            className={inputClassName}
            min={0}
            onChange={(event) =>
              updateField("estimated_crowd_size", event.target.value)
            }
            placeholder="25000"
            type="number"
            value={formData.estimated_crowd_size}
          />
        </label>

        <label className="text-sm font-medium text-ink-700">
          Idempotency key
          <input
            className={inputClassName}
            onChange={(event) =>
              updateField("idempotency_key", event.target.value)
            }
            placeholder="auto-generated if blank"
            value={formData.idempotency_key}
          />
        </label>

        <label className="text-sm font-medium text-ink-700 md:col-span-2">
          Operational description
          <textarea
            className={`${inputClassName} min-h-28 resize-y leading-6`}
            onChange={(event) =>
              updateField("operational_description", event.target.value)
            }
            required
            value={formData.operational_description}
          />
        </label>

        <label className="text-sm font-medium text-ink-700 md:col-span-2">
          Officer ground note
          <textarea
            className={`${inputClassName} min-h-20 resize-y leading-6`}
            onChange={(event) =>
              updateField("operator_override_notes", event.target.value)
            }
            placeholder="Optional. Stored as feedback, never used to block the officer."
            value={formData.operator_override_notes}
          />
        </label>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      <div className="mt-5 flex justify-end">
        <button
          className="inline-flex items-center gap-2 rounded bg-signal px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoading}
          type="submit"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {isLoading ? "Predicting" : "Predict impact"}
        </button>
      </div>
    </form>
  );
}
