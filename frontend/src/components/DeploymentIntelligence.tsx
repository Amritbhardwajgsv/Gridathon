import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  FileText,
  GitBranch,
  MapPinned,
  Radio,
  Route,
  ShieldAlert,
  Sparkles,
  Users
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  LearningSignal,
  NlpSignal,
  PredictImpactPayload,
  PredictImpactResponse,
  ResourceRecommendation
} from "@/types/prediction";

interface DeploymentIntelligenceProps {
  payload: PredictImpactPayload | null;
  result: PredictImpactResponse | null;
}

const impactScore: Record<string, number> = {
  Low: 2,
  Medium: 5,
  High: 7,
  Critical: 9
};

export default function DeploymentIntelligence({
  payload,
  result
}: DeploymentIntelligenceProps) {
  if (!payload || !result) {
    return <AwaitingForecast />;
  }

  const score = impactScore[result.impact_level] ?? 4;
  const resource = result.resource_recommendation ?? fallbackResource(payload, result);
  const nlp = result.nlp_signal ?? fallbackNlp(payload);
  const learning = result.learning_signal ?? fallbackLearning();
  const modeLabel =
    payload.pipeline_mode === "planned"
      ? "planned / document-first"
      : "unplanned / SLA-first";

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="relative overflow-hidden bg-ink-950 px-5 py-5 text-white">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-signal to-transparent" />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
                DRISHTI operational forecast
              </div>
              <h2 className="mt-2 max-w-3xl text-2xl font-semibold leading-tight">
                {payload.event_name || payload.event_cause_grouped.replaceAll("_", " ")}
              </h2>
              <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300">
                {modeLabel} / DRISHTI forecast / {payload.zone}
              </div>
            </div>
            <StatusBadge label={result.impact_level} tone={result.impact_level} />
          </div>
        </div>

        <div className="grid gap-0 divide-y divide-line p-5 text-sm md:grid-cols-4 md:divide-x md:divide-y-0">
          <PlanRow
            icon={<Clock3 className="h-4 w-4" />}
            label="impact window"
            value={`${result.predicted_duration_minutes} minutes predicted clearance`}
          />
          <PlanRow
            icon={<Users className="h-4 w-4" />}
            label="personnel"
            value={`${resource.personnel_total} total / ${resource.si} SI / ${resource.asi} ASI`}
          />
          <PlanRow
            icon={<ShieldAlert className="h-4 w-4" />}
            label="barricading"
            value={`${resource.barricades} barricades on ${payload.corridor}`}
          />
          <PlanRow
            icon={<Route className="h-4 w-4" />}
            label="diversion confidence"
            value={`${Math.round(resource.diversion_confidence * 100)}% compliance-weighted`}
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-signal" />
              <h2 className="text-base font-semibold text-ink-950">
                Resource deployment order
              </h2>
            </div>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal">
              generated from forecast output
            </span>
          </div>

          <div className="rounded-md border border-line bg-mist p-4">
            <div className="text-sm font-semibold text-ink-950">
              {resource.primary_action}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <MiniMetric label="Constables" value={resource.constables} />
              <MiniMetric label="Inspectors" value={resource.inspectors} />
              <MiniMetric label="Tow units" value={resource.tow_units} />
              <MiniMetric label="Medical units" value={resource.medical_units} />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {resource.deployment_notes.map((note) => (
              <div
                className="rounded border border-line bg-white px-3 py-2 text-sm leading-6 text-ink-600"
                key={note}
              >
                {note}
              </div>
            ))}
          </div>
        </section>

        <AgentBriefing nlp={nlp} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-ink-950">
              Three-window response timeline
            </h2>
            <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-signal">
              field workflow
            </span>
          </div>
          <div className="relative space-y-5 pl-6 before:absolute before:left-2 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-line">
            <TimelineItem
              active={payload.pipeline_mode === "planned"}
              label="Pre-event"
              note={`Prepare station deployment for ${payload.corridor}; check overlap before barricade issue.`}
              time={payload.pipeline_mode === "planned" ? "T-48h to T-3h" : "rapid estimate"}
            />
            <TimelineItem
              active
              label="During event"
              note={`Track ${payload.zone}; closure flag is ${payload.requires_road_closure ? "active" : "inactive"}.`}
              time={`hour ${payload.hour}:00`}
            />
            <TimelineItem
              label="Post-event"
              note="Capture actual clearance, diversion response, citizen complaint density, and officer ground notes."
              time="T+1h onward"
            />
          </div>
        </section>

        <LearningPanel learning={learning} />
      </div>

      <section className="rounded-md border border-line bg-white shadow-soft">
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          <MapPinned className="h-4 w-4 text-signal" />
          <h2 className="text-base font-semibold text-ink-950">
            Corridor intelligence
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-mist font-mono text-[10px] uppercase tracking-[0.12em] text-ink-300">
              <tr>
                <th className="px-4 py-3 text-left">Corridor</th>
                <th className="px-4 py-3 text-left">Choke score</th>
                <th className="px-4 py-3 text-left">Impact</th>
                <th className="px-4 py-3 text-left">Compliance</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              <CorridorRow
                action="Primary deployment"
                choke={Math.min(9.8, score + 1.4)}
                compliance={resource.diversion_confidence}
                corridor={payload.corridor}
                impact={score}
              />
              <CorridorRow
                action="Diversion support"
                choke={Math.max(2.1, score - 1.6)}
                compliance={Math.min(0.92, resource.diversion_confidence + 0.14)}
                corridor="Parallel approach road"
                impact={Math.max(1, score - 2)}
              />
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AwaitingForecast() {
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-md border border-line bg-white shadow-soft">
        <div className="bg-ink-950 px-5 py-4 text-white">
          <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-signal">
            Awaiting event context
          </div>
          <h2 className="mt-2 text-xl font-semibold">
            DRISHTI output will appear here
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-100">
            Send an event with location, timing, crowd estimate, and field
            description. DRISHTI returns impact, deployment strength, police triage,
            and post-event review points in one operational record.
          </p>
        </div>
        <div className="grid gap-0 divide-y divide-line p-5 md:grid-cols-3 md:divide-x md:divide-y-0">
          <PlanRow
            icon={<Clock3 className="h-4 w-4" />}
            label="planned lane"
            value="Batch-first output for deployment sheet and DCP approval note."
          />
          <PlanRow
            icon={<Radio className="h-4 w-4" />}
            label="unplanned lane"
            value="SLA-first response for sudden gathering or incident escalation."
          />
          <PlanRow
            icon={<FileText className="h-4 w-4" />}
            label="review loop"
            value="Resolved outcomes and complaint density support weekly command review."
          />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="rounded-md border border-line bg-white p-5 shadow-soft">
          <div className="mb-4 flex items-center gap-2">
            <MapPinned className="h-4 w-4 text-signal" />
            <h2 className="text-base font-semibold text-ink-950">
              Problem statement path
            </h2>
          </div>
          <div className="relative space-y-5 pl-6 before:absolute before:left-2 before:top-2 before:h-[calc(100%-16px)] before:w-px before:bg-line">
            <TimelineItem
              active
              label="1. Quantify event impact"
              note="Political rallies, festivals, sports events, construction activity, and sudden gatherings are entered as structured signals."
              time="intake"
            />
            <TimelineItem
              label="2. Recommend deployment"
              note="DRISHTI converts duration and impact into manpower, barricading, tow, medical, and diversion confidence."
              time="operations"
            />
            <TimelineItem
              label="3. Learn after event"
              note="Actual clearance, complaints, and officer notes become weekly review inputs."
              time="feedback"
            />
          </div>
        </section>

        <section className="rounded-md border border-line bg-white p-5 shadow-soft">
          <h2 className="mb-4 text-base font-semibold text-ink-950">
            Trust rails active
          </h2>
          <div className="space-y-3">
            <TrustRail
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="P1 nonblocking"
              body="Prediction continues even if logging or external geocoding fails."
            />
            <TrustRail
              icon={<GitBranch className="h-4 w-4" />}
              title="P4 idempotency"
              body="Repeated operational requests resolve to one stable record."
            />
            <TrustRail
              icon={<ShieldAlert className="h-4 w-4" />}
              title="P8 PII boundary"
              body="Forecast input excludes vehicle numbers, citizen IDs, and officer identifiers."
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function AgentBriefing({ nlp }: { nlp: NlpSignal }) {
  return (
    <section className="rounded-md border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <BrainCircuit className="h-4 w-4 text-signal" />
        <h2 className="text-base font-semibold text-ink-950">
          NLP agent briefing
        </h2>
      </div>
      <div className="rounded-md border border-line bg-mist p-4">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300">
          urgency score
        </div>
        <div className="mt-1 text-3xl font-semibold text-ink-950">
          {nlp.urgency_score}
        </div>
        <div className="mt-3 h-2 rounded bg-white">
          <div
            className="h-2 rounded bg-signal"
            style={{ width: `${Math.min(100, nlp.urgency_score)}%` }}
          />
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-600">{nlp.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {nlp.keywords.length ? (
          nlp.keywords.map((keyword) => (
            <span
              className="rounded bg-ink-50 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-500"
              key={keyword}
            >
              {keyword}
            </span>
          ))
        ) : (
          <span className="text-sm text-ink-400">No risk keywords detected.</span>
        )}
      </div>
      <div className="mt-4 text-xs text-ink-400">
        Agent path: {nlp.agent_used}
      </div>
    </section>
  );
}

function LearningPanel({ learning }: { learning: LearningSignal }) {
  return (
    <section className="rounded-md border border-line bg-white p-5 shadow-soft">
      <div className="mb-4 flex items-center gap-2">
        <FileText className="h-4 w-4 text-signal" />
        <h2 className="text-base font-semibold text-ink-950">
          Post-event review
        </h2>
      </div>
      <div className="rounded-md border border-line bg-mist p-3">
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300">
          review priority
        </div>
        <div className="mt-1 text-sm font-semibold uppercase text-ink-950">
          {learning.retraining_priority}
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {learning.post_event_questions.map((question) => (
          <div className="rounded border border-line px-3 py-2 text-sm text-ink-600" key={question}>
            {question}
          </div>
        ))}
      </div>
    </section>
  );
}

function PlanRow({
  icon,
  label,
  value
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 p-4">
      <div className="mt-0.5 text-signal">{icon}</div>
      <div>
        <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300">
          {label}
        </div>
        <div className="mt-1 font-medium text-ink-700">{value}</div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-white p-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink-300">
        {label}
      </div>
      <div className="mt-1 text-xl font-semibold text-ink-950">{value}</div>
    </div>
  );
}

function TimelineItem({
  active,
  label,
  note,
  time
}: {
  active?: boolean;
  label: string;
  note: string;
  time: string;
}) {
  return (
    <div className="relative">
      <span
        className={`absolute -left-[21px] top-1 h-3 w-3 rounded-full border-2 border-white ${
          active ? "bg-signal" : "bg-ink-300"
        }`}
      />
      <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink-300">
        {time}
      </div>
      <div className={`mt-1 text-sm font-semibold ${active ? "text-signal" : "text-ink-950"}`}>
        {label}
      </div>
      <p className="mt-1 text-sm text-ink-500">{note}</p>
    </div>
  );
}

function TrustRail({
  body,
  icon,
  title
}: {
  body: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <div className="rounded-md border border-line bg-mist p-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink-950">
        <span className="text-pine">{icon}</span>
        {title}
      </div>
      <p className="mt-1 text-xs leading-5 text-ink-500">{body}</p>
    </div>
  );
}

function CorridorRow({
  action,
  choke,
  compliance,
  corridor,
  impact
}: {
  action: string;
  choke: number;
  compliance: number;
  corridor: string;
  impact: number;
}) {
  const tone = impact >= 7 ? "bg-red-700" : impact >= 4 ? "bg-amber" : "bg-pine";

  return (
    <tr className="text-ink-700">
      <td className="px-4 py-3 font-medium text-ink-950">{corridor}</td>
      <td className="px-4 py-3">
        <span className={`rounded px-2 py-1 font-mono text-xs text-white ${tone}`}>
          {choke.toFixed(1)}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-24 rounded bg-ink-50">
            <div className={`h-2 rounded ${tone}`} style={{ width: `${impact * 10}%` }} />
          </div>
          <span className="font-mono text-xs">{impact}/10</span>
        </div>
      </td>
      <td className="px-4 py-3 font-mono text-xs">{compliance.toFixed(2)}</td>
      <td className="px-4 py-3">{action}</td>
    </tr>
  );
}

function StatusBadge({ label, tone }: { label: string; tone: string }) {
  const className =
    tone === "Critical"
      ? "bg-red-100 text-red-800"
      : tone === "High"
        ? "bg-orange-100 text-orange-800"
        : tone === "Medium"
          ? "bg-amber-100 text-amber-800"
          : "bg-emerald-100 text-emerald-800";

  return (
    <span className={`inline-flex items-center gap-2 rounded px-3 py-1 font-mono text-xs font-medium ${className}`}>
      <AlertTriangle className="h-3 w-3" />
      {label}
    </span>
  );
}

function fallbackNlp(payload: PredictImpactPayload): NlpSignal {
  return {
    summary: payload.operational_description || "Operational description processed.",
    keywords: [],
    urgency_score: payload.priority === "Critical" ? 90 : payload.priority === "High" ? 70 : 45,
    detected_risks: [],
    agent_used: "frontend_fallback"
  };
}

function fallbackResource(
  payload: PredictImpactPayload,
  result: PredictImpactResponse
): ResourceRecommendation {
  const score = impactScore[result.impact_level] ?? 4;
  const total = Math.max(10, Math.round(result.predicted_duration_minutes / 10 + score * 6));
  return {
    personnel_total: total,
    constables: Math.max(6, total - 5),
    asi: 3,
    si: 1,
    inspectors: 1,
    barricades: Math.max(6, score * 3),
    tow_units: payload.requires_road_closure ? 1 : 0,
    medical_units: result.impact_level === "Critical" ? 1 : 0,
    diversion_confidence: payload.requires_road_closure ? 0.58 : 0.72,
    primary_action: "Pre-position traffic staff and keep diversion support ready.",
    deployment_notes: [
      `Focus first deployment on ${payload.corridor}.`,
      `Predicted clearance window is ${result.predicted_duration_minutes} minutes.`
    ]
  };
}

function fallbackLearning(): LearningSignal {
  return {
    feedback_required: true,
    retraining_priority: "standard",
    expected_ground_truth_fields: ["actual_duration_minutes", "actual_impact_level"],
    post_event_questions: [
      "Was the personnel count adequate?",
      "Did the suggested diversion route work?",
      "Was dispersal slower than predicted?"
    ],
    learning_notes: ["Store post-event outcome for weekly command review."]
  };
}
