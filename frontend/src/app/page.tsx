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
import Image from "next/image";
import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#060c18] text-[#dde8f5] overflow-x-hidden">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-[#1c2e4a] bg-[#060c18]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3.5">
          <Link className="flex items-center gap-3" href="/">
            <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
              <Radio className="h-4 w-4 text-white" />
              <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#060c18] bg-[#10b981]" />
            </div>
            <div>
              <div className="font-mono text-[13px] font-bold tracking-[0.18em] text-[#22d3ee]">DRISHTI</div>
              <div className="mono-id leading-none">Bengaluru Police · Traffic Ops</div>
            </div>
          </Link>

          <div className="flex items-center gap-1">
            <Link className="px-3 py-2 text-[12px] text-[#7c9ab8] transition hover:text-[#dde8f5]" href="/citizen/grievance">
              Report
            </Link>
            <Link className="px-3 py-2 text-[12px] text-[#7c9ab8] transition hover:text-[#dde8f5]" href="/citizen/track">
              Track
            </Link>
            <Link
              className="ml-2 inline-flex items-center gap-1.5 rounded-lg border border-[#1c2e4a] px-4 py-2 text-[12px] font-medium text-[#7c9ab8] transition hover:border-[#243a5c] hover:text-[#dde8f5]"
              href="/register"
            >
              Request Access
            </Link>
            <Link
              className="ml-1 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#0ea5c5] to-[#2d6ce0] px-4 py-2 text-[12px] font-semibold text-white transition hover:opacity-90"
              href="/login"
            >
              Police Login
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden border-b border-[#1c2e4a] px-5 pb-24 pt-20">
        {/* Background city map */}
        <div className="pointer-events-none absolute inset-0 opacity-30">
          <Image src="/hero-city.svg" alt="" fill className="object-cover" priority />
        </div>
        {/* Grid overlay */}
        <div className="grid-overlay pointer-events-none absolute inset-0" />
        {/* Radial glow center */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.08)_0%,transparent_70%)]" />

        <div className="reveal-up relative mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_460px]">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-[#22d3ee]/25 bg-[#22d3ee]/8 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#22d3ee]">
                <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
                Bengaluru Police · Active Operations
              </div>

              <h1 className="text-[44px] font-bold leading-[1.05] tracking-tight md:text-[60px]">
                <span className="text-[#f0f6ff]">Dynamic Resource</span><br />
                <span className="gradient-text">Intelligence</span>{" "}
                <span className="text-[#f0f6ff]">for</span><br />
                <span className="text-[#f0f6ff]">Traffic Operations</span>
              </h1>

              <p className="mt-6 max-w-xl text-[15px] leading-7 text-[#7c9ab8]">
                DRISHTI is Bengaluru Police&apos;s ML-powered platform — RandomForest
                models predict incident severity and duration, GPS dispatch assigns
                nearest officers in seconds, and field teams report status in real time.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link className="btn-primary text-[13px]" href="/login">
                  <ShieldCheck className="h-4 w-4" />
                  Police Login
                </Link>
                <Link className="btn-ghost text-[13px]" href="/citizen/grievance">
                  <MessageSquareWarning className="h-4 w-4" />
                  Report Incident
                </Link>
                <Link className="btn-ghost text-[13px]" href="/citizen/track">
                  <ClipboardList className="h-4 w-4" />
                  Track Complaint
                </Link>
              </div>

              {/* Stats strip */}
              <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { v: "2",     l: "ML Models",      s: "Severity · Duration" },
                  { v: "22+",   l: "BTP Corridors",  s: "ORR · CBD · Hosur" },
                  { v: "4",     l: "Severity Levels", s: "Critical to Low" },
                  { v: "<200ms",l: "API Latency",    s: "End-to-end predict" },
                ].map((stat) => (
                  <div className="rounded-lg border border-[#1c2e4a] bg-[#0d1629]/70 px-4 py-3" key={stat.l}>
                    <div className="font-mono text-[22px] font-bold text-[#22d3ee]">{stat.v}</div>
                    <div className="mt-0.5 text-[11px] font-semibold text-[#dde8f5]">{stat.l}</div>
                    <div className="mt-0.5 text-[10px] text-[#3d5278]">{stat.s}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero image — Bengaluru map */}
            <div className="flex items-center justify-center">
              <div className="relative">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-[#22d3ee]/10 to-[#3b82f6]/10" />
                <div className="overflow-hidden rounded-2xl border border-[#22d3ee]/20">
                  <Image src="/hero-city.svg" alt="Bengaluru Traffic Network" width={460} height={280} className="block" />
                </div>
                {/* Live blip */}
                <div className="absolute -right-3 -top-3 flex items-center gap-2 rounded-lg border border-[#1c2e4a] bg-[#0d1629] px-3 py-1.5 shadow-xl">
                  <span className="live-breathe h-2 w-2 rounded-full bg-[#22d3ee]" />
                  <span className="mono-id text-[#22d3ee]">LIVE OPS</span>
                </div>
                {/* ML badge */}
                <div className="absolute -bottom-3 -left-3 flex items-center gap-2 rounded-lg border border-[#1c2e4a] bg-[#0d1629] px-3 py-1.5 shadow-xl">
                  <BrainCircuit className="h-3.5 w-3.5 text-[#a78bfa]" />
                  <span className="mono-id text-[#a78bfa]">RF CLASSIFIER · ACTIVE</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="border-b border-[#1c2e4a] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <div className="section-kicker mb-3 text-[#22d3ee]">Operational Workflow</div>
            <h2 className="text-[32px] font-bold text-[#f0f6ff]">From signal to field resolution</h2>
            <p className="mx-auto mt-3 max-w-xl text-[14px] leading-7 text-[#7c9ab8]">
              Every traffic event flows through a four-phase ML pipeline with automated decisions at each step.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "01", phase: "Citizen Signal",    desc: "A report enters the queue. DRISHTI AI auto-scores severity using the RF classifier and generates a dispatch recommendation.",  color: "text-[#22d3ee]", bg: "bg-[#22d3ee]/10", border: "border-[#22d3ee]/20" },
              { n: "02", phase: "ML Forecast",       desc: "RandomForest predicts blockage duration and exact resource requirement — personnel strength, barricades, tow units.",           color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10", border: "border-[#3b82f6]/20" },
              { n: "03", phase: "Nearest Dispatch",  desc: "GPS haversine match finds closest available officers. One click creates the duty order and issues the field brief.",             color: "text-[#a78bfa]", bg: "bg-[#a78bfa]/10", border: "border-[#a78bfa]/20" },
              { n: "04", phase: "Field Execution",   desc: "Officers report En Route → On Scene → Resolved via the field dashboard. Status syncs to Command in real time.",                color: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20" },
            ].map((step) => (
              <div className={`cmd-card border ${step.border} p-6`} key={step.n}>
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-lg font-mono text-[13px] font-bold ${step.bg} ${step.color}`}>
                  {step.n}
                </div>
                <div className={`mt-5 text-[11px] font-bold uppercase tracking-[0.1em] ${step.color}`}>{step.phase}</div>
                <p className="mt-2 text-[13px] leading-6 text-[#7c9ab8]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ML models section ────────────────────────────────────────────────── */}
      <section className="border-b border-[#1c2e4a] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_400px]">
            <div>
              <div className="section-kicker mb-3 text-[#22d3ee]">Machine Learning Core</div>
              <h2 className="text-[32px] font-bold text-[#f0f6ff]">
                Two RandomForest models.<br />
                <span className="gradient-text">Real-time predictions.</span>
              </h2>
              <p className="mt-4 text-[14px] leading-7 text-[#7c9ab8]">
                Trained on Bengaluru&apos;s Astram event dataset. Features include corridor, zone,
                event type, road closure flag, and time-of-day. Predicts in under 200ms.
              </p>

              <div className="mt-8 space-y-4">
                {[
                  { title: "Severity Classifier", sub: "RandomForestClassifier · 300 estimators", labels: ["Critical","High","Medium","Low"], colors: ["bg-[#ef4444]","bg-[#f59e0b]","bg-[#3b82f6]","bg-[#10b981]"] },
                  { title: "Duration Regressor",  sub: "RandomForestRegressor · 300 estimators",  labels: ["Minutes"],                       colors: ["bg-[#22d3ee]"] },
                ].map((model) => (
                  <div className="cmd-card p-5" key={model.title}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-[13px] font-semibold text-[#f0f6ff]">{model.title}</div>
                        <div className="mono-id mt-1">{model.sub}</div>
                      </div>
                      <BrainCircuit className="h-4 w-4 shrink-0 text-[#a78bfa]" />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {model.labels.map((l, i) => (
                        <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase text-[#060c18] ${model.colors[i] ?? "bg-[#22d3ee]"}`} key={l}>
                          {l}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center">
              <Image src="/ml-visual.svg" alt="ML Neural Net" width={320} height={200} className="opacity-90" />
            </div>
          </div>
        </div>
      </section>

      {/* ── Capabilities grid ────────────────────────────────────────────────── */}
      <section className="border-b border-[#1c2e4a] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <div className="section-kicker mb-3 text-[#22d3ee]">Platform Capabilities</div>
            <h2 className="text-[32px] font-bold text-[#f0f6ff]">Everything a command room needs</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: BrainCircuit, title: "ML Severity Assessment",    body: "RandomForest classifier predicts incident severity from complaint type, corridor, zone, and time. Overrides manual guessing.",    accent: "text-[#22d3ee]", bg: "bg-[#22d3ee]/8",  border: "border-[#22d3ee]/15" },
              { icon: Users,        title: "Nearest-Officer Dispatch",   body: "Haversine GPS matching finds the closest available officers in real time and assigns them with one click.",                          accent: "text-[#10b981]", bg: "bg-[#10b981]/8",  border: "border-[#10b981]/15" },
              { icon: Activity,     title: "Live Field Tracking",        body: "Officers push GPS every 30s. Command sees availability, last-seen time, and assigned corridor on a live map.",                       accent: "text-[#3b82f6]", bg: "bg-[#3b82f6]/8",  border: "border-[#3b82f6]/15" },
              { icon: Zap,          title: "Resource Recommendation",    body: "Each prediction returns exact strength: constables, ASIs, SIs, inspectors, barricades, tow units, and medical units.",              accent: "text-[#a78bfa]", bg: "bg-[#a78bfa]/8",  border: "border-[#a78bfa]/15" },
              { icon: MapPinned,    title: "En Route Navigation",        body: "Field officers see live Mappls route to destination, nearby colleague markers, and a real-time command chat.",                        accent: "text-[#f59e0b]", bg: "bg-[#f59e0b]/8",  border: "border-[#f59e0b]/15" },
              { icon: MessageSquareWarning, title: "Command Chat",       body: "WebSocket-based live chat between Command Centre and field officers. Full history, reconnect on drop, role-labelled messages.",      accent: "text-[#ef4444]", bg: "bg-[#ef4444]/8",  border: "border-[#ef4444]/15" },
            ].map((cap) => {
              const Icon = cap.icon;
              return (
                <div className={`cmd-card border ${cap.border} p-6 transition-all hover:border-opacity-40`} key={cap.title}>
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${cap.bg} ${cap.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-[14px] font-semibold text-[#f0f6ff]">{cap.title}</h3>
                  <p className="mt-2 text-[13px] leading-6 text-[#7c9ab8]">{cap.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Role cards ───────────────────────────────────────────────────────── */}
      <section className="border-b border-[#1c2e4a] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-12 text-center">
            <div className="section-kicker mb-3 text-[#22d3ee]">Access Roles</div>
            <h2 className="text-[32px] font-bold text-[#f0f6ff]">Three roles, one integrated system</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            {[
              { href: "/login?role=admin", icon: ShieldCheck, tag: "COMMAND CENTRE", title: "Admin", desc: "Full ops view: ML forecasts, complaint queue, GPS dispatch, personnel map, access approval, and live analytics.", features: ["ML impact prediction","Nearest-officer dispatch","Personnel map","Complaint queue"], border: "border-[#22d3ee]/20 hover:border-[#22d3ee]/50", iconBg: "bg-[#22d3ee]/10", iconColor: "text-[#22d3ee]", accent: "text-[#22d3ee]" },
              { href: "/login?role=operator", icon: Navigation, tag: "FIELD OFFICER", title: "Operator", desc: "Duty assignment view, live GPS beacon, En Route navigation with Mappls map, and real-time command chat.", features: ["Live assignment brief","GPS beacon sync","Mappls navigation","Command chat"], border: "border-[#3b82f6]/20 hover:border-[#3b82f6]/50", iconBg: "bg-[#3b82f6]/10", iconColor: "text-[#3b82f6]", accent: "text-[#3b82f6]" },
              { href: "/login?role=viewer", icon: Activity,   tag: "POLICE REVIEW",  title: "Viewer", desc: "Read-only operational reports: severity distribution, complaint trends, forecast history, and city coverage.", features: ["Severity charts","Forecast history","Coverage report","Complaint trends"], border: "border-[#a78bfa]/20 hover:border-[#a78bfa]/50", iconBg: "bg-[#a78bfa]/10", iconColor: "text-[#a78bfa]", accent: "text-[#a78bfa]" },
            ].map((role) => {
              const Icon = role.icon;
              return (
                <Link className={`cmd-card group flex flex-col border p-6 transition-all ${role.border}`} href={role.href} key={role.href}>
                  <div className="flex items-start justify-between gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${role.iconBg} ${role.iconColor}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`mono-id rounded border border-current/20 px-2 py-1 ${role.accent}`}>{role.tag}</span>
                  </div>
                  <h3 className="mt-5 text-[18px] font-bold text-[#f0f6ff]">{role.title}</h3>
                  <p className="mt-2 flex-1 text-[13px] leading-6 text-[#7c9ab8]">{role.desc}</p>
                  <ul className="mt-5 space-y-1.5">
                    {role.features.map((f) => (
                      <li className={`flex items-center gap-2 text-[12px] ${role.accent}`} key={f}>
                        <ChevronRight className="h-3 w-3 opacity-60" />{f}
                      </li>
                    ))}
                  </ul>
                  <div className={`mt-5 inline-flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-[0.08em] ${role.accent} opacity-0 transition group-hover:opacity-100`}>
                    Open Login <ArrowRight className="h-3.5 w-3.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Citizen portal ───────────────────────────────────────────────────── */}
      <section className="border-b border-[#1c2e4a] px-5 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
            <div>
              <div className="section-kicker mb-3 text-[#22d3ee]">Public Access</div>
              <h2 className="text-[32px] font-bold text-[#f0f6ff]">Citizen complaint portal</h2>
              <p className="mt-4 max-w-xl text-[14px] leading-7 text-[#7c9ab8]">
                Any citizen can report a traffic issue — no login required. DRISHTI AI
                auto-assesses severity, routes it to the nearest officer, and generates
                a tracking token instantly.
              </p>
              <p className="mt-3 max-w-xl text-[14px] leading-7 text-[#7c9ab8]">
                Use token <span className="font-mono text-[#22d3ee]">DRS-BTP-A3C9F1</span> to
                track your complaint status at any time.
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
            <div className="cmd-card p-6">
              <div className="section-kicker mb-4 text-[#22d3ee]">Reportable categories</div>
              {[
                { l: "Event congestion",    d: "Concerts, rallies, marathons causing gridlock",     c: "bg-[#f59e0b]" },
                { l: "Illegal parking",     d: "Vehicles blocking junctions or bus stops",           c: "bg-[#3b82f6]" },
                { l: "Road closure",        d: "Unexpected blockages or diversions",                 c: "bg-[#ef4444]" },
                { l: "Accident / breakdown",d: "Vehicle collision or breakdown on carriageway",      c: "bg-[#a78bfa]" },
                { l: "Signal failure",      d: "Traffic light malfunction at junction",              c: "bg-[#22d3ee]" },
              ].map((item) => (
                <div className="flex gap-3 border-b border-[#1c2e4a] py-3 last:border-0" key={item.l}>
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${item.c}`} />
                  <div>
                    <div className="text-[13px] font-semibold text-[#f0f6ff]">{item.l}</div>
                    <div className="mt-0.5 text-[11px] text-[#3d5278]">{item.d}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#1c2e4a] px-5 py-8">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <div>
              <div className="font-mono text-[12px] font-bold tracking-widest text-[#22d3ee]">DRISHTI</div>
              <div className="mono-id text-[#3d5278]">Bengaluru Police · Traffic Ops Command</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-6 text-[12px] text-[#3d5278]">
            <Link className="hover:text-[#dde8f5]" href="/citizen/grievance">Report Incident</Link>
            <Link className="hover:text-[#dde8f5]" href="/citizen/track">Track Complaint</Link>
            <Link className="hover:text-[#dde8f5]" href="/register">Officer Access</Link>
            <Link className="hover:text-[#dde8f5]" href="/login">Police Login</Link>
          </div>
        </div>
      </footer>
    </main>
  );
}
