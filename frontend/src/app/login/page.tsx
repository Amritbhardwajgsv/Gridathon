"use client";

import {
  AlertCircle,
  ArrowRight,
  Eye,
  EyeOff,
  LogIn,
  Radio,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import axios from "axios";

import { getDashboardForRole, loginUser } from "@/lib/auth";
import { roleShortLabel } from "@/lib/roles";
import type { UserRole } from "@/types/prediction";

const DEMO: Record<UserRole, string> = {
  admin:    "admin@gridathon.local",
  operator: "operator@gridathon.local",
  viewer:   "viewer@gridathon.local",
};

const ROLE_CONFIG: Record<UserRole, { label: string; color: string; borderActive: string; bgActive: string; textActive: string }> = {
  admin:    { label: "Admin",    color: "#FFE600", borderActive: "border-[#FFE600]",  bgActive: "bg-[#FFE600]/10",  textActive: "text-[#FFE600]"  },
  operator: { label: "Operator", color: "#22D3EE", borderActive: "border-[#22D3EE]",  bgActive: "bg-[#22D3EE]/10",  textActive: "text-[#22D3EE]"  },
  viewer:   { label: "Viewer",   color: "#A78BFA", borderActive: "border-[#A78BFA]",  bgActive: "bg-[#A78BFA]/10",  textActive: "text-[#A78BFA]"  },
};

export default function LoginPage() {
  const router = useRouter();
  const [email,        setEmail]        = useState(DEMO.operator);
  const [password,     setPassword]     = useState("Drishti@123");
  const [role,         setRole]         = useState<UserRole>("operator");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const [busy,         setBusy]         = useState(false);

  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const r = p.get("role") as UserRole | null;
    if (r && r in DEMO) pick(r);
  }, []);

  function pick(r: UserRole) {
    setRole(r);
    setEmail(DEMO[r]);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const user = await loginUser({ email, password });
      router.replace(getDashboardForRole(user.role));
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const d = err.response?.data?.detail;
        setError(typeof d === "string" ? d : "Login failed — check credentials or approval status.");
      } else {
        setError("Login failed — check credentials or approval status.");
      }
    } finally {
      setBusy(false);
    }
  }

  const rc = ROLE_CONFIG[role];

  return (
    <main className="grid min-h-screen bg-[#08080F] lg:grid-cols-[minmax(0,1fr)_500px]">

      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <section className="relative hidden overflow-hidden border-r-2 border-[#252535] px-14 py-10 lg:flex lg:flex-col lg:justify-between">
        <div className="grid-overlay pointer-events-none absolute inset-0 opacity-[0.03]" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-2/3 bg-gradient-to-t from-[#08080F] to-transparent" />

        {/* Logo */}
        <Link className="relative flex items-center gap-3" href="/">
          <div className="flex h-10 w-10 items-center justify-center rounded bg-[#FFE600]">
            <Radio className="h-5 w-5 text-[#08080F]" />
          </div>
          <div>
            <div className="font-mono text-[14px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">Bengaluru Police Operations</div>
          </div>
        </Link>

        {/* Center display copy */}
        <div className="relative">
          <div className="mb-6 inline-flex items-center gap-2 rounded border-2 border-[#10B981]/30 bg-[#10B981]/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#10B981]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Restricted Police Access
          </div>
          <h1 className="max-w-lg text-[44px] font-black uppercase leading-[1.0] tracking-[-0.02em] text-[#F0F0F8]">
            Command Centre,<br />
            <span className="text-[#FFE600]">dispatch &amp; field</span><br />
            ops console.
          </h1>

          <div className="mt-10 space-y-3">
            {[
              { l: "Access",   t: "New personnel request access — Command Centre approves before login is enabled." },
              { l: "Location", t: "Approved field officers share badge-linked GPS location after sign-in." },
              { l: "Tasks",    t: "Duty assignments appear with Mappls route map and live command chat." },
            ].map((p) => (
              <div className="browser-card" key={p.l}>
                <div className="browser-card-header border-b-2 border-[#252535]">
                  <span className="browser-dot browser-dot-red" />
                  <span className="browser-dot browser-dot-yellow" />
                  <span className="browser-dot browser-dot-green" />
                  <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#FFE600]">{p.l}</span>
                </div>
                <div className="px-4 py-3 text-[13px] leading-6 text-[#8888A0]">{p.t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-[#444455]">
          Bengaluru Police operational system · 2026
        </div>
      </section>

      {/* ── Right panel (form) ─────────────────────────────────────────────── */}
      <section className="flex items-center justify-center bg-[#08080F] px-8 py-12">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded bg-[#FFE600]">
              <Radio className="h-4 w-4 text-[#08080F]" />
            </div>
            <div className="font-mono text-[13px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</div>
          </div>

          <h2 className="text-[28px] font-black uppercase tracking-[-0.01em] text-[#F0F0F8]">Police Login</h2>
          <p className="mt-2 text-[13px] text-[#8888A0]">Access the DRISHTI operational console.</p>

          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded border-2 border-[#EF4444]/30 bg-[#EF4444]/8 px-4 py-3 text-[13px] text-[#FCA5A5]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#EF4444]" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="mt-8 space-y-5" onSubmit={handleSubmit}>

            {/* Role picker */}
            <div>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8888A0]">Role</div>
              <div className="grid grid-cols-3 gap-2">
                {(["operator", "admin", "viewer"] as UserRole[]).map((r) => {
                  const cfg = ROLE_CONFIG[r];
                  const active = role === r;
                  return (
                    <button
                      className={`rounded border-2 py-2.5 text-[11px] font-bold uppercase tracking-[0.06em] transition ${
                        active
                          ? `${cfg.borderActive} ${cfg.bgActive} ${cfg.textActive}`
                          : "border-[#252535] bg-[#0F0F1A] text-[#8888A0] hover:border-[#333348] hover:text-[#F0F0F8]"
                      }`}
                      key={r}
                      onClick={() => pick(r)}
                      type="button"
                    >
                      {active && (
                        <span
                          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle"
                          style={{ background: cfg.color }}
                        />
                      )}
                      {roleShortLabel(r)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8888A0]" htmlFor="login-email">Email</label>
              <input
                className="field-dark"
                id="login-email"
                onChange={(e) => setEmail(e.target.value)}
                placeholder="officer@police.gov.in"
                required
                type="email"
                value={email}
              />
            </div>

            {/* Password */}
            <div>
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8888A0]" htmlFor="login-password">Password</label>
              <div className="relative">
                <input
                  className="field-dark pr-12"
                  id="login-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  title="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444455] transition hover:text-[#8888A0]"
                  onClick={() => setShowPassword((p) => !p)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              className="btn-primary w-full justify-center py-3"
              disabled={busy}
              type="submit"
            >
              <LogIn className="h-4 w-4" />
              {busy ? "Signing in…" : "Enter Console"}
              {!busy && <ArrowRight className="h-4 w-4 ml-auto" />}
            </button>
          </form>

          {/* Demo hint */}
          <div className="browser-card mt-6">
            <div className="browser-card-header border-b-2 border-[#252535]">
              <span className="browser-dot browser-dot-red" />
              <span className="browser-dot browser-dot-yellow" />
              <span className="browser-dot browser-dot-green" />
              <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">DEMO CREDENTIALS</span>
            </div>
            <div className="px-4 py-3 text-[12px] text-[#8888A0]">
              <div className="flex items-center gap-2 text-[#F0F0F8]">
                <Zap className="h-3.5 w-3.5 text-[#FFE600]" />
                Quick access — email auto-fills on role select
              </div>
              <div className="mt-2">
                Password: <span className="font-mono font-bold text-[#FFE600]">Drishti@123</span>
              </div>
            </div>
          </div>

          <div className="mt-5 space-y-2 text-center text-[12px] text-[#444455]">
            <div>
              Need access?{" "}
              <Link className="font-bold text-[#FFE600] hover:underline" href="/register">
                Request officer access
              </Link>
            </div>
            <div>
              Traffic analyst?{" "}
              <Link className="font-bold text-[#A78BFA] hover:underline" href="/register/viewer">
                Register as viewer
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
