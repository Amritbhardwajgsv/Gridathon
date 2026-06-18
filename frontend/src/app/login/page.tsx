"use client";

import {
  AlertCircle,
  Eye,
  EyeOff,
  LogIn,
  Radio,
  ShieldCheck,
  Zap,
} from "lucide-react";
import Image from "next/image";
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

const ROLE_STYLE: Record<UserRole, { active: string; dot: string }> = {
  admin:    { active: "border-[#22d3ee] bg-[#22d3ee]/10 text-[#22d3ee]",   dot: "bg-[#22d3ee]" },
  operator: { active: "border-[#3b82f6] bg-[#3b82f6]/10 text-[#3b82f6]",   dot: "bg-[#3b82f6]" },
  viewer:   { active: "border-[#a78bfa] bg-[#a78bfa]/10 text-[#a78bfa]",   dot: "bg-[#a78bfa]" },
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

  const rs = ROLE_STYLE[role];

  return (
    <main className="grid min-h-screen bg-[#060c18] lg:grid-cols-[minmax(0,1fr)_480px]">

      {/* ── Left panel ────────────────────────────────────────────────────── */}
      <section className="relative hidden overflow-hidden border-r border-[#1c2e4a] px-12 py-10 lg:flex lg:flex-col lg:justify-between">
        {/* Background */}
        <div className="grid-overlay pointer-events-none absolute inset-0 opacity-60" />
        <div className="pointer-events-none absolute inset-0 opacity-25">
          <Image src="/hero-city.svg" alt="" fill className="object-cover" />
        </div>
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-1/2 bg-gradient-to-t from-[#060c18] to-transparent" />

        {/* Logo */}
        <Link className="relative flex items-center gap-3" href="/">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
            <Radio className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-mono text-[14px] font-bold tracking-[0.18em] text-[#22d3ee]">DRISHTI</div>
            <div className="mono-id leading-none">Bengaluru Police Operations</div>
          </div>
        </Link>

        {/* Center copy */}
        <div className="relative">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#10b981]/30 bg-[#10b981]/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#10b981]">
            <ShieldCheck className="h-3.5 w-3.5" />
            Restricted Police Access
          </div>
          <h1 className="max-w-xl text-[36px] font-bold leading-tight text-[#f0f6ff]">
            Command Centre,<br />
            <span className="gradient-text">dispatch & field</span><br />
            operations console.
          </h1>
          <div className="mt-8 space-y-3">
            {[
              { l: "Access",   t: "New personnel request access — Command Centre approves before login." },
              { l: "Location", t: "Approved field officers share badge-linked GPS location after sign-in." },
              { l: "Tasks",    t: "Duty assignments appear with Mappls route map and live command chat." },
            ].map((p) => (
              <div className="rounded-xl border border-[#1c2e4a] bg-[#0d1629]/60 p-4 backdrop-blur-sm" key={p.l}>
                <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#22d3ee]">{p.l}</div>
                <div className="text-[13px] leading-6 text-[#7c9ab8]">{p.t}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative mono-id text-[#3d5278]">Bengaluru Police operational system · 2026</div>
      </section>

      {/* ── Right panel (form) ─────────────────────────────────────────────── */}
      <section className="flex items-center justify-center bg-[#060c18] px-6 py-10">
        <div className="w-full max-w-sm">

          {/* Mobile logo */}
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <div className="font-mono text-[14px] font-bold tracking-[0.18em] text-[#22d3ee]">DRISHTI</div>
          </div>

          <h2 className="text-[26px] font-bold text-[#f0f6ff]">Police Login</h2>
          <p className="mt-1.5 text-[13px] text-[#7c9ab8]">
            Access the DRISHTI operational console.
          </p>

          {error ? (
            <div className="mt-5 flex items-start gap-3 rounded-xl border border-[#ef4444]/25 bg-[#ef4444]/8 px-4 py-3 text-[13px] text-[#fca5a5]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ef4444]" />
              <span>{error}</span>
            </div>
          ) : null}

          <form className="mt-7 space-y-5" onSubmit={handleSubmit}>

            {/* Role picker */}
            <div>
              <div className="mb-2 text-[12px] font-semibold text-[#7c9ab8]">Role</div>
              <div className="grid grid-cols-3 gap-2">
                {(["operator","admin","viewer"] as UserRole[]).map((r) => {
                  const s = ROLE_STYLE[r];
                  const active = role === r;
                  return (
                    <button
                      className={`rounded-lg border py-2.5 text-[12px] font-semibold transition ${
                        active ? s.active : "border-[#1c2e4a] bg-[#0d1629] text-[#7c9ab8] hover:border-[#243a5c]"
                      }`}
                      key={r}
                      onClick={() => pick(r)}
                      type="button"
                    >
                      {active && <span className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full ${s.dot} align-middle`} />}
                      {roleShortLabel(r)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Email */}
            <div>
              <label className="mb-2 block text-[12px] font-semibold text-[#7c9ab8]" htmlFor="login-email">Email</label>
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
              <label className="mb-2 block text-[12px] font-semibold text-[#7c9ab8]" htmlFor="login-password">Password</label>
              <div className="relative">
                <input
                  className="field-dark pr-10"
                  id="login-password"
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  title="Password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#3d5278] transition hover:text-[#7c9ab8]"
                  onClick={() => setShowPassword((p) => !p)}
                  type="button"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              className="btn-primary w-full justify-center py-2.5 text-[13px]"
              disabled={busy}
              type="submit"
            >
              <LogIn className="h-4 w-4" />
              {busy ? "Signing in…" : "Enter Console"}
            </button>
          </form>

          {/* Demo hint */}
          <div className="mt-5 rounded-xl border border-[#1c2e4a] bg-[#0d1629] p-4 text-[12px] text-[#3d5278]">
            <div className="flex items-center gap-2 text-[#7c9ab8]">
              <Zap className="h-3.5 w-3.5 text-[#22d3ee]" />
              Demo credentials
            </div>
            <div className="mt-2">Password: <span className="font-mono font-semibold text-[#dde8f5]">Drishti@123</span></div>
            <div className="mt-1">Email auto-fills when you pick a role above.</div>
          </div>

          <div className="mt-5 space-y-2 text-center text-[12px] text-[#3d5278]">
            <div>
              Need access?{" "}
              <Link className="font-semibold text-[#22d3ee] hover:underline" href="/register">
                Request officer access
              </Link>
            </div>
            <div>
              Traffic analyst?{" "}
              <Link className="font-semibold text-[#a78bfa] hover:underline" href="/register/viewer">
                Register as viewer
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
