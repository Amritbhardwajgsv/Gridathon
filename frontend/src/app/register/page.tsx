"use client";

import { ArrowLeft, ArrowRight, Radio, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { registerUser } from "@/lib/auth";

const RANKS = ["Constable", "Head Constable", "ASI", "SI", "Inspector", "ACP", "DCP"];

const UNITS = [
  "BTP Central Division",
  "BTP East Division",
  "BTP West Division",
  "BTP North Division",
  "BTP South Division",
  "BTP South-East Division",
  "BTP North-East Division",
  "BTP Whitefield Division",
  "BTP Electronic City Division",
  "BTP Hebbal Division",
  "BTP Silk Board Division",
  "BTP Airport Division",
  "Traffic Training School, Bengaluru",
];

export default function RegisterPage() {
  const router = useRouter();
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("Drishti@123");
  const [badgeId,  setBadgeId]  = useState("");
  const [rank,     setRank]     = useState("Constable");
  const [unitName, setUnit]     = useState("BTP East Division");
  const [error,    setError]    = useState("");
  const [busy,     setBusy]     = useState(false);
  const [done,     setDone]     = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await registerUser({
        badge_id:  badgeId || undefined,
        email,
        name:      name || email.split("@")[0],
        password,
        rank:      rank || undefined,
        role:      "operator",
        unit_name: unitName || undefined,
      });
      setDone(true);
    } catch {
      setError("Could not create access request. The email may already exist.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#08080F] text-[#F0F0F8]">

      {/* Header */}
      <header className="border-b-2 border-[#252535] px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link className="flex items-center gap-3" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-[#FFE600]">
              <Radio className="h-4 w-4 text-[#08080F]" />
            </div>
            <span className="font-mono text-[12px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</span>
          </Link>
          <Link className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] text-[#444455] transition hover:text-[#8888A0]" href="/login">
            <ArrowLeft className="h-3.5 w-3.5" />Back to login
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-6 py-14">

        {/* Page title */}
        <div className="mb-10">
          <div className="section-kicker mb-3 text-[#FFE600]">+ Field Officer Access</div>
          <h1 className="text-[34px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
            Request officer<br />access.
          </h1>
          <p className="mt-4 text-[13px] leading-6 text-[#8888A0]">
            Submit your badge details. Command Centre reviews and approves before login is enabled.
          </p>
        </div>

        {done ? (
          <div className="browser-card border-2 border-[#10B981]/30">
            <div className="browser-card-header border-b-2 border-[#10B981]/30">
              <span className="browser-dot browser-dot-red" />
              <span className="browser-dot browser-dot-yellow" />
              <span className="browser-dot browser-dot-green" />
              <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#10B981]">REQUEST SUBMITTED</span>
            </div>
            <div className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded bg-[#10B981]/15">
                <ShieldCheck className="h-7 w-7 text-[#10B981]" />
              </div>
              <h2 className="mt-5 text-[20px] font-black uppercase text-[#F0F0F8]">Request submitted</h2>
              <p className="mt-2 text-[13px] text-[#8888A0]">
                Command Centre will review your request. You will be able to log in once approved.
              </p>
              <Link className="btn-primary mt-7 inline-flex" href="/login">
                Go to login <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="browser-card">
            <div className="browser-card-header border-b-2 border-[#252535]">
              <span className="browser-dot browser-dot-red" />
              <span className="browser-dot browser-dot-yellow" />
              <span className="browser-dot browser-dot-green" />
              <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">OFFICER REGISTRATION</span>
            </div>
            <div className="p-6">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <FormField htmlFor="reg-name" label="Full name">
                  <input className="field-dark" id="reg-name" onChange={(e) => setName(e.target.value)} placeholder="Inspector Ravi Kumar" required type="text" value={name} />
                </FormField>

                <FormField htmlFor="reg-email" label="Work email">
                  <input className="field-dark" id="reg-email" onChange={(e) => setEmail(e.target.value)} placeholder="officer@ksp.gov.in" required type="email" value={email} />
                </FormField>

                <FormField htmlFor="reg-badge" label="Police badge / staff ID">
                  <input className="field-dark" id="reg-badge" onChange={(e) => setBadgeId(e.target.value)} placeholder="BTP-2045-A" type="text" value={badgeId} />
                </FormField>

                <FormField htmlFor="reg-rank" label="Rank">
                  <select className="field-dark" id="reg-rank" onChange={(e) => setRank(e.target.value)} title="Rank" value={rank}>
                    {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                </FormField>

                <FormField htmlFor="reg-unit" label="Unit / station">
                  <select className="field-dark" id="reg-unit" onChange={(e) => setUnit(e.target.value)} title="Unit / Station" value={unitName}>
                    {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </FormField>

                <FormField htmlFor="reg-pass" label="Password">
                  <input className="field-dark" id="reg-pass" onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required title="Password" type="password" value={password} />
                </FormField>

                {error ? (
                  <div className="rounded border-2 border-[#EF4444]/30 bg-[#EF4444]/8 px-3 py-2.5 text-[12px] text-[#FCA5A5]">
                    {error}
                  </div>
                ) : null}

                <button className="btn-primary w-full justify-center py-3" disabled={busy} type="submit">
                  <ShieldCheck className="h-4 w-4" />
                  {busy ? "Sending request…" : "Request field access"}
                  {!busy && <ArrowRight className="h-4 w-4 ml-auto" />}
                </button>
              </form>

              <div className="mt-6 space-y-2 border-t-2 border-[#252535] pt-5 text-center text-[12px] text-[#444455]">
                <div>
                  Traffic analyst?{" "}
                  <Link className="font-bold text-[#A78BFA] hover:underline" href="/register/viewer">Register as viewer</Link>
                </div>
                <div>
                  Already registered?{" "}
                  <Link className="font-bold text-[#FFE600] hover:underline" href="/login">Sign in</Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function FormField({ children, htmlFor, label }: { children: React.ReactNode; htmlFor: string; label: string }) {
  return (
    <div>
      <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.14em] text-[#8888A0]" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
