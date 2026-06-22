import type { Metadata } from "next";
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  ChevronRight,
  ClipboardList,
  MapPinned,
  MessageSquareWarning,
  Navigation,
  Radio,
  ShieldCheck,
  Siren,
  Users,
  Zap,
} from "lucide-react";
import Link from "next/link";

export const metadata: Metadata = {
  title: "DRISHTI — AI Traffic Operations Platform | Bengaluru Police",
  description:
    "Bengaluru Police's AI-powered traffic operations command platform. Report incidents in plain language, track complaint status, and see real-time field deployment. Powered by NLP, ML impact prediction, and GPS officer dispatch.",
  alternates: { canonical: "https://drishti-ex4s.onrender.com" },
  openGraph: {
    title: "DRISHTI — AI Traffic Operations | Bengaluru Police",
    description:
      "Report a traffic incident in plain language. DRISHTI extracts structured fields, predicts impact, and dispatches Bengaluru Police officers automatically.",
    url: "https://drishti-ex4s.onrender.com",
  },
};

import DescriptionPipelinePreview from "@/components/DescriptionPipelinePreview";
import RecentIncidentsFeed from "@/components/RecentIncidentsFeed";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#08080F] text-[#F0F0F8] overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b-2 border-[#252535] bg-[#08080F]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#FFE600]">
              <Radio className="h-4 w-4 text-[#08080F]" />
            </div>
            <div>
              <div className="font-mono text-[13px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</div>
              <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">Bengaluru Police · Traffic Ops</div>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <Link className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8888A0] transition hover:text-[#F0F0F8]" href="/citizen/grievance">
              Report
            </Link>
            <Link className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8888A0] transition hover:text-[#F0F0F8]" href="/citizen/track">
              Track
            </Link>
            <Link
              className="ml-2 inline-flex items-center gap-1.5 rounded border-2 border-[#252535] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8888A0] transition hover:border-[#FFE600] hover:text-[#FFE600]"
              href="/register"
            >
              Request Access
            </Link>
            <Link
              className="ml-1 btn-primary text-[11px]"
              href="/login"
            >
              Police Login
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b-2 border-[#252535] px-6 pb-24 pt-20">
        <div className="grid-overlay pointer-events-none absolute inset-0 opacity-[0.03]" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[700px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(255,230,0,0.04)_0%,transparent_65%)]" />

        <div className="reveal-up relative mx-auto max-w-7xl">
          <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_480px]">
            <div className="flex flex-col justify-center">

              {/* Live badge */}
              <div className="mb-8 inline-flex w-fit items-center gap-2.5 rounded-full border-2 border-[#FFE600]/25 bg-[#FFE600]/8 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">
                <span className="live-breathe h-2 w-2 rounded-full bg-[#FFE600]" />
                Bengaluru Police · Active Operations
              </div>

              <div className="typing-shell mb-5" aria-label="AI sees the signal. Teams move.">
                <span className="typing-text">AI sees the signal. Teams move.</span>
              </div>

              {/* Main headline */}
              <h1 className="text-[48px] font-black leading-[0.96] tracking-[-0.02em] md:text-[68px] uppercase">
                <span className="block text-[#F0F0F8]">Dynamic</span>
                <span className="block text-[#FFE600]">Resource</span>
                <span className="block text-[#F0F0F8]">Intelligence.</span>
              </h1>

              <p className="mt-7 max-w-lg text-[15px] leading-7 text-[#8888A0]">
                Describe the traffic problem in detail. DRISHTI extracts the operational
                fields, assesses urgency, and prepares the incident for police action.
                Citizens explain what happened; the command team handles the rest.
              </p>

              {/* CTA row */}
              <div className="mt-9 flex flex-wrap gap-3">
                <Link className="btn-primary" href="/login">
                  <ShieldCheck className="h-4 w-4" />
                  Police Login
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <Link className="btn-ghost" href="/citizen/grievance">
                  <MessageSquareWarning className="h-4 w-4" />
                  Report Incident
                </Link>
                <Link className="btn-ghost" href="/citizen/track">
                  <ClipboardList className="h-4 w-4" />
                  Track Complaint
                </Link>
              </div>

              {/* Stats strip */}
              <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { v: "1",   l: "Input",           s: "Detailed description" },
                  { v: "NLP", l: "Auto Extraction", s: "Structured incident fields" },
                  { v: "AI",  l: "Assessment",      s: "Priority and resources" },
                  { v: "24/7", l: "Police Workflow", s: "Review to resolution" },
                ].map((stat) => (
                  <div className="rounded border-2 border-[#252535] bg-[#0F0F1A] px-4 py-3" key={stat.l}>
                    <div className="font-mono text-[22px] font-bold text-[#FFE600]">{stat.v}</div>
                    <div className="mt-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-[#F0F0F8]">{stat.l}</div>
                    <div className="mt-0.5 text-[10px] text-[#444455]">{stat.s}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero browser-window card */}
            <div className="flex items-center justify-center">
              <DescriptionPipelinePreview />
              <div className="hidden">
                {/* Browser dots header */}
                <div className="browser-card-header border-b-2 border-[#252535]">
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                  <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">
                    DRISHTI · COMMAND CENTRE
                  </span>
                  <span className="ml-auto flex items-center gap-1.5">
                    <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#FFE600]" />
                    <span className="font-mono text-[9px] text-[#FFE600]">LIVE OPS</span>
                  </span>
                </div>

                {/* Simulated dashboard preview */}
                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Critical", val: "3", color: "text-[#EF4444]", bg: "bg-[#EF4444]/10" },
                      { label: "Deployed", val: "12", color: "text-[#FFE600]", bg: "bg-[#FFE600]/10" },
                      { label: "Resolved", val: "47", color: "text-[#10B981]", bg: "bg-[#10B981]/10" },
                    ].map((s) => (
                      <div className={`rounded border-2 border-[#252535] p-3 ${s.bg}`} key={s.label}>
                        <div className={`font-mono text-[22px] font-bold ${s.color}`}>{s.val}</div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#8888A0]">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {[
                    { id: "DRS-A3C9", loc: "Trinity Circle", sev: "Critical", color: "text-[#EF4444]", dot: "bg-[#EF4444]" },
                    { id: "DRS-B7E2", loc: "Silk Board Jn", sev: "High",     color: "text-[#F59E0B]", dot: "bg-[#F59E0B]" },
                    { id: "DRS-F1D4", loc: "Hebbal Flyover",  sev: "Medium",   color: "text-[#3B82F6]", dot: "bg-[#3B82F6]" },
                  ].map((item) => (
                    <div className="flex items-center justify-between rounded border-2 border-[#252535] bg-[#0F0F1A] px-4 py-3" key={item.id}>
                      <div className="flex items-center gap-3">
                        <span className={`h-2 w-2 rounded-full ${item.dot}`} />
                        <div>
                          <div className="font-mono text-[10px] text-[#444455]">{item.id}</div>
                          <div className="text-[12px] font-semibold text-[#F0F0F8]">{item.loc}</div>
                        </div>
                      </div>
                      <span className={`rounded border border-current/30 px-2 py-0.5 text-[9px] font-bold uppercase ${item.color}`}>
                        {item.sev}
                      </span>
                    </div>
                  ))}

                  <div className="rounded border-2 border-[#FFE600]/20 bg-[#FFE600]/5 px-4 py-3 flex items-center gap-3">
                    <BrainCircuit className="h-4 w-4 text-[#FFE600] shrink-0" />
                    <div className="text-[11px] font-semibold text-[#FFE600]">
                      Description processing
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── ADL-style yellow search bar CTA ─────────────────────────────────── */}
      <section className="border-b-2 border-[#252535] px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-center gap-4 rounded-full border-2 border-[#FFE600] bg-[#FFE600] px-6 py-4">
            <Siren className="h-5 w-5 text-[#08080F] shrink-0" />
            <span className="flex-1 font-mono text-[13px] font-bold uppercase tracking-[0.12em] text-[#08080F]">
              WHAT HAPPENS WHEN A TRAFFIC CRISIS HITS A CITY OF 10 MILLION?
            </span>
            <Link
              href="/citizen/grievance"
              className="shrink-0 rounded-full border-2 border-[#08080F] bg-[#08080F] px-5 py-2 text-[11px] font-black uppercase tracking-[0.1em] text-[#FFE600] transition hover:bg-[#0F0F1A]"
            >
              Report Now →
            </Link>
          </div>
        </div>
      </section>

      {/* Recent incidents live feed */}
      <RecentIncidentsFeed />

      {/* News clippings */}
      <section className="border-b-2 border-[#252535] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-5">
            <div>
              <div className="section-kicker mb-3 text-[#f47f5f]">+ In the news</div>
              <h2 className="text-[36px] font-black uppercase leading-[1.02] tracking-[-0.01em] text-[#F0F0F8]">
                Bengaluru traffic<br />is the headline.
              </h2>
            </div>
            <p className="max-w-md text-[14px] leading-7 text-[#8888A0]">
              Congestion costs commuters time every day and makes faster,
              description-led traffic response essential.
            </p>
          </div>

          <div className="grid items-stretch gap-6 lg:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
            <article className="browser-card overflow-hidden border-[#f47f5f]/25 bg-[#fff8f2] p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="section-kicker text-[#f47f5f]">News clipping 01</span>
                <span className="rounded-full bg-[#FFE600]/20 px-3 py-1 font-mono text-[9px] font-bold uppercase text-[#795b4e]">Congestion index</span>
              </div>
              <div className="flex min-h-[520px] items-center justify-center overflow-hidden rounded-xl bg-black sm:min-h-[620px]">
                <img alt="News clipping reporting Bengaluru as the world's second most congested city" className="max-h-[620px] w-full object-contain" loading="lazy" src="/news/bengaluru-congestion-headline.png" />
              </div>
            </article>

            <article className="browser-card overflow-hidden border-[#FFE600]/35 bg-[#fff8f2] p-3 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="section-kicker text-[#f47f5f]">News clipping 02</span>
                <span className="rounded-full bg-[#f47f5f]/10 px-3 py-1 font-mono text-[9px] font-bold uppercase text-[#d66a45]">City mobility</span>
              </div>
              <div className="flex min-h-[300px] items-center justify-center overflow-hidden rounded-xl bg-[#111827] sm:min-h-[420px] lg:h-[620px]">
                <img alt="Television news clipping about Bengaluru being the second most congested city globally" className="max-h-[620px] w-full object-contain" loading="lazy" src="/news/bengaluru-congestion-broadcast.png" />
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="border-b-2 border-[#252535] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <div className="section-kicker mb-3 text-[#FFE600]">+ Operational Workflow</div>
            <h2 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
              From signal to<br />field resolution.
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", phase: "Describe the problem", desc: "The citizen writes one detailed account of what is happening. No technical fields or operational decisions are required.", color: "text-[#FFE600]", border: "border-[#FFE600]/30", dot: "bg-[#FFE600]" },
              { n: "02", phase: "NLP extraction", desc: "DRISHTI reads the description and derives cause, vehicle type, road impact, urgency, and other structured fields.", color: "text-[#22D3EE]", border: "border-[#22D3EE]/30", dot: "bg-[#22D3EE]" },
              { n: "03", phase: "Police action", desc: "The structured incident reaches Command for review, resource planning, assignment, and field instructions.", color: "text-[#A78BFA]", border: "border-[#A78BFA]/30", dot: "bg-[#A78BFA]" },
              { n: "04", phase: "Resolve and learn", desc: "Officers manage the incident through resolution. Completed cases feed the controlled weekly retraining cycle.", color: "text-[#10B981]", border: "border-[#10B981]/30", dot: "bg-[#10B981]" },
            ].map((step) => (
              <div className={`browser-card border-2 ${step.border}`} key={step.n}>
                <div className="browser-card-header border-b-2 border-[#252535]">
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                </div>
                <div className="p-5">
                  <div className={`font-mono text-[32px] font-black ${step.color}`}>{step.n}</div>
                  <div className={`mt-3 text-[10px] font-black uppercase tracking-[0.14em] ${step.color}`}>{step.phase}</div>
                  <p className="mt-2 text-[13px] leading-6 text-[#8888A0]">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ML models section ────────────────────────────────────────────────── */}
      <section className="border-b-2 border-[#252535] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <div className="section-kicker mb-3 text-[#FFE600]">+ Machine Learning Core</div>
              <h2 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
                One description.<br />
                <span className="text-[#FFE600]">Structured operational</span><br />
                intelligence.
              </h2>
              <p className="mt-5 text-[14px] leading-7 text-[#8888A0]">
                Citizens provide the detail they know in natural language. NLP converts it
                into consistent incident fields, then the prediction and recommendation
                pipeline prepares it for police review and action.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { title: "NLP Field Extraction", sub: "Description to structured incident", labels: ["Cause","Vehicle","Road impact","Urgency"], colors: ["bg-[#FFE600]","bg-[#f47f5f]","bg-[#FFE600]","bg-[#f47f5f]"] },
                  { title: "Command Preparation", sub: "Assessment and recommendation", labels: ["Priority","Resources","Dispatch brief"], colors: ["bg-[#FFE600]","bg-[#f47f5f]","bg-[#FFE600]"] },
                ].map((model) => (
                  <div className="browser-card" key={model.title}>
                    <div className="browser-card-header border-b-2 border-[#252535]">
                      <span className="browser-dot" style={{ background: "#FF5F57" }} />
                      <span className="browser-dot" style={{ background: "#FEBC2E" }} />
                      <span className="browser-dot" style={{ background: "#28C840" }} />
                      <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#444455]">{model.sub}</span>
                    </div>
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-[14px] font-black uppercase tracking-[0.04em] text-[#F0F0F8]">{model.title}</div>
                        <BrainCircuit className="h-4 w-4 shrink-0 text-[#FFE600]" />
                      </div>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {model.labels.map((l, i) => (
                          <span className={`rounded px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.06em] text-[#08080F] ${model.colors[i] ?? "bg-[#FFE600]"}`} key={l}>
                            {l}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Stylised ML visual */}
            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot" style={{ background: "#FF5F57" }} />
                <span className="browser-dot" style={{ background: "#FEBC2E" }} />
                <span className="browser-dot" style={{ background: "#28C840" }} />
                <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#444455]">MODEL INFERENCE</span>
              </div>
              <div className="p-8">
                <div className="space-y-4">
                  {[
                    { label: "Input", val: "One detailed description" },
                    { label: "Cause", val: "Vehicle breakdown" },
                    { label: "Vehicle", val: "City bus" },
                    { label: "Road impact", val: "Two lanes blocked" },
                  ].map((row) => (
                    <div className="flex items-center justify-between border-b-2 border-[#252535] pb-3 last:border-0" key={row.label}>
                      <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-[#8888A0]">{row.label}</span>
                      <span className="font-mono text-[12px] font-bold text-[#F0F0F8]">{row.val}</span>
                    </div>
                  ))}
                  <div className="mt-4 rounded border-2 border-[#FFE600]/30 bg-[#FFE600]/8 p-4">
                    <div className="section-kicker text-[#FFE600]">Command-ready assessment</div>
                    <div className="mt-2 font-mono text-[24px] font-black text-[#FFE600]">HIGH PRIORITY</div>
                    <div className="mt-1 text-[12px] text-[#8888A0]">Structured fields and a response brief are ready for police review.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities grid ────────────────────────────────────────────────── */}
      <section className="border-b-2 border-[#252535] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <div className="section-kicker mb-3 text-[#FFE600]">+ Platform Capabilities</div>
            <h2 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
              Everything a<br />command room needs.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BrainCircuit, title: "Description Intelligence", body: "NLP extracts operational fields directly from the citizen&apos;s detailed description; no technical form-filling is required.", accent: "#FFE600" },
              { icon: Users,        title: "Nearest-Officer Dispatch",  body: "Haversine GPS matching finds the closest available officers in real time and assigns them with one click.",                         accent: "#10B981" },
              { icon: Activity,     title: "Live Field Tracking",       body: "Officers push GPS every 30s. Command sees availability, last-seen time, and assigned corridor on a live map.",                        accent: "#3B82F6" },
              { icon: Zap,          title: "Resource Recommendation",   body: "Each prediction returns exact strength: constables, ASIs, SIs, inspectors, barricades, tow units, and medical units.",               accent: "#A78BFA" },
              { icon: MapPinned,    title: "En Route Navigation",       body: "Field officers see live Mappls route to destination, nearby colleague markers, and a real-time command chat.",                        accent: "#F59E0B" },
              { icon: MessageSquareWarning, title: "Command Chat",      body: "WebSocket-based live chat between Command Centre and field officers. Full history, reconnect on drop, role-labelled messages.",       accent: "#E84B5A" },
            ].map((cap) => {
              const Icon = cap.icon;
              return (
                <div className="browser-card cmd-card-glow" key={cap.title}>
                  <div className="browser-card-header border-b-2 border-[#252535]">
                    <span className="browser-dot" style={{ background: "#FF5F57" }} />
                    <span className="browser-dot" style={{ background: "#FEBC2E" }} />
                    <span className="browser-dot" style={{ background: "#28C840" }} />
                  </div>
                  <div className="p-5">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded"
                      style={{ background: `${cap.accent}18`, color: cap.accent }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-4 text-[13px] font-black uppercase tracking-[0.04em] text-[#F0F0F8]">{cap.title}</h3>
                    <p className="mt-2 text-[13px] leading-6 text-[#8888A0]">{cap.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Role cards ───────────────────────────────────────────────────────── */}
      <section className="border-b-2 border-[#252535] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12">
            <div className="section-kicker mb-3 text-[#FFE600]">+ Access Roles</div>
            <h2 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
              Three roles,<br />one integrated system.
            </h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              { href: "/login?role=admin",    icon: ShieldCheck, tag: "COMMAND CENTRE", title: "Admin",    desc: "Full ops view: ML forecasts, complaint queue, GPS dispatch, personnel map, access approval, and live analytics.", features: ["ML impact prediction","Nearest-officer dispatch","Personnel map","Complaint queue"], accent: "#FFE600" },
              { href: "/login?role=operator", icon: Navigation,  tag: "FIELD OFFICER",  title: "Operator", desc: "Duty assignment view, live GPS beacon, En Route navigation with Mappls map, and real-time command chat.",          features: ["Live assignment brief","GPS beacon sync","Mappls navigation","Command chat"],           accent: "#22D3EE" },
              { href: "/login?role=viewer",   icon: Activity,    tag: "POLICE REVIEW",  title: "Viewer",   desc: "Read-only operational reports: severity distribution, complaint trends, forecast history, and city coverage.",    features: ["Severity charts","Forecast history","Coverage report","Complaint trends"],              accent: "#A78BFA" },
            ].map((role) => {
              const Icon = role.icon;
              return (
                <Link
                  className="browser-card group flex flex-col transition-all hover:border-current"
                  href={role.href}
                  key={role.href}
                  style={{ borderColor: `${role.accent}30` }}
                >
                  <div className="browser-card-header border-b-2" style={{ borderColor: `${role.accent}30` }}>
                    <span className="browser-dot" style={{ background: "#FF5F57" }} />
                    <span className="browser-dot" style={{ background: "#FEBC2E" }} />
                    <span className="browser-dot" style={{ background: "#28C840" }} />
                    <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em]" style={{ color: role.accent }}>{role.tag}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded" style={{ background: `${role.accent}18`, color: role.accent }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="mt-5 text-[22px] font-black uppercase tracking-[-0.01em] text-[#F0F0F8]">{role.title}</h3>
                    <p className="mt-2 flex-1 text-[13px] leading-6 text-[#8888A0]">{role.desc}</p>
                    <ul className="mt-5 space-y-2">
                      {role.features.map((f) => (
                        <li className="flex items-center gap-2 text-[12px] font-semibold" key={f} style={{ color: role.accent }}>
                          <ChevronRight className="h-3 w-3 opacity-70" />{f}
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.1em] opacity-0 transition group-hover:opacity-100" style={{ color: role.accent }}>
                      Open Login <ArrowRight className="h-3.5 w-3.5" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Citizen portal ───────────────────────────────────────────────────── */}
      <section className="border-b-2 border-[#252535] px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <div className="section-kicker mb-3 text-[#FFE600]">+ Public Access</div>
              <h2 className="text-[36px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
                Citizen complaint<br />portal.
              </h2>
              <p className="mt-5 max-w-xl text-[14px] leading-7 text-[#8888A0]">
                Any citizen can report a traffic issue without logging in. Write one clear,
                detailed description of the problem. DRISHTI extracts the useful incident
                fields and sends the structured case into the police workflow.
              </p>
              <p className="mt-3 max-w-xl text-[14px] leading-7 text-[#8888A0]">
                After submission, use the generated tracking token to follow police updates
                through dispatch and resolution.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="btn-primary" href="/citizen/grievance">
                  <Siren className="h-4 w-4" />Report an Incident
                </Link>
                <Link className="btn-ghost" href="/citizen/track">
                  <ClipboardList className="h-4 w-4" />Track My Complaint
                </Link>
              </div>
            </div>

            <div className="browser-card">
              <div className="browser-card-header border-b-2 border-[#252535]">
                <span className="browser-dot" style={{ background: "#FF5F57" }} />
                <span className="browser-dot" style={{ background: "#FEBC2E" }} />
                <span className="browser-dot" style={{ background: "#28C840" }} />
                <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#444455]">REPORTABLE CATEGORIES</span>
              </div>
              <div className="p-5">
                {[
                  { l: "Event congestion",     d: "Concerts, rallies, marathons causing gridlock",     c: "#F59E0B" },
                  { l: "Illegal parking",      d: "Vehicles blocking junctions or bus stops",           c: "#3B82F6" },
                  { l: "Road closure",         d: "Unexpected blockages or diversions",                 c: "#EF4444" },
                  { l: "Accident / breakdown", d: "Vehicle collision or breakdown on carriageway",      c: "#A78BFA" },
                  { l: "Signal failure",       d: "Traffic light malfunction at junction",              c: "#FFE600" },
                ].map((item) => (
                  <div className="flex gap-3 border-b-2 border-[#252535] py-3.5 last:border-0" key={item.l}>
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ background: item.c }} />
                    <div>
                      <div className="text-[13px] font-bold text-[#F0F0F8]">{item.l}</div>
                      <div className="mt-0.5 text-[11px] text-[#444455]">{item.d}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── JSON-LD structured data ──────────────────────────────────────────── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "WebApplication",
                "@id": "https://drishti-ex4s.onrender.com/#webapp",
                name: "DRISHTI — Bengaluru Police Traffic Operations",
                url: "https://drishti-ex4s.onrender.com",
                description:
                  "AI-powered traffic operations platform for Bengaluru Police. Citizens report incidents in plain language; DRISHTI extracts structured data, predicts impact, and dispatches field officers automatically.",
                applicationCategory: "GovernmentApplication",
                operatingSystem: "Web",
                offers: { "@type": "Offer", price: "0", priceCurrency: "INR" },
                featureList: [
                  "NLP incident field extraction",
                  "ML impact and duration prediction",
                  "GPS officer dispatch",
                  "Citizen complaint portal",
                  "Real-time command chat",
                  "Resource recommendation",
                ],
                inLanguage: ["en", "kn"],
                areaServed: {
                  "@type": "City",
                  name: "Bengaluru",
                  containedInPlace: { "@type": "State", name: "Karnataka", containedInPlace: { "@type": "Country", name: "India" } },
                },
              },
              {
                "@type": "Organization",
                "@id": "https://drishti-ex4s.onrender.com/#org",
                name: "Bengaluru Traffic Police",
                url: "https://drishti-ex4s.onrender.com",
                logo: "https://drishti-ex4s.onrender.com/opengraph-image",
                areaServed: { "@type": "City", name: "Bengaluru" },
              },
              {
                "@type": "WebSite",
                "@id": "https://drishti-ex4s.onrender.com/#website",
                url: "https://drishti-ex4s.onrender.com",
                name: "DRISHTI",
                publisher: { "@id": "https://drishti-ex4s.onrender.com/#org" },
                potentialAction: {
                  "@type": "SearchAction",
                  target: {
                    "@type": "EntryPoint",
                    urlTemplate: "https://drishti-ex4s.onrender.com/citizen/track?id={search_term_string}",
                  },
                  "query-input": "required name=search_term_string",
                },
              },
            ],
          }),
        }}
      />

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t-2 border-[#252535] px-6 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#FFE600]">
              <Radio className="h-4 w-4 text-[#08080F]" />
            </div>
            <div>
              <div className="font-mono text-[13px] font-bold tracking-widest text-[#FFE600]">DRISHTI</div>
              <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#444455]">Bengaluru Police · Traffic Ops Command</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-[11px] font-bold uppercase tracking-[0.08em] text-[#444455]">
            <Link className="hover:text-[#FFE600] transition" href="/citizen/grievance">Report Incident</Link>
            <Link className="hover:text-[#FFE600] transition" href="/citizen/track">Track Complaint</Link>
            <Link className="hover:text-[#FFE600] transition" href="/register">Officer Access</Link>
            <Link className="hover:text-[#FFE600] transition" href="/login">Police Login</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
