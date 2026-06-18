"use client";

import { ArrowLeft, Radio, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { registerUser } from "@/lib/auth";

const RANKS = ["Constable", "Head Constable", "ASI", "SI", "Inspector", "ACP", "DCP"];

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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
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
    <main className="min-h-screen bg-[#060c18] text-[#dde8f5]">
      <header className="border-b border-[#1c2e4a] px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link className="flex items-center gap-2.5" href="/">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
              <Radio className="h-4 w-4 text-white" />
            </div>
            <span className="font-mono text-[13px] font-bold tracking-[0.18em] text-[#22d3ee]">DRISHTI</span>
          </Link>
          <Link className="inline-flex items-center gap-1.5 text-[12px] text-[#3d5278] hover:text-[#7c9ab8]" href="/login">
            <ArrowLeft className="h-3.5 w-3.5" />Back to login
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-5 py-14">
        <div className="mb-8 text-center">
          <div className="section-kicker mb-3 text-[#22d3ee]">Field Officer Access</div>
          <h1 className="text-[28px] font-bold text-[#f0f6ff]">Request officer access</h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-[#7c9ab8]">
            Submit your badge details. Command Centre reviews and approves before login is enabled.
          </p>
        </div>

        {done ? (
          <div className="cmd-card border-[#10b981]/25 p-8 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-[#10b981]" />
            <h2 className="mt-4 text-[18px] font-bold text-[#f0f6ff]">Request submitted</h2>
            <p className="mt-2 text-[13px] text-[#7c9ab8]">
              Command Centre will review your request. You will be able to log in once approved.
            </p>
            <Link className="btn-primary mt-6 inline-flex" href="/login">
              Go to login
            </Link>
          </div>
        ) : (
          <div className="cmd-card p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <DarkField htmlFor="reg-name" label="Full name">
                <input className="field-dark" id="reg-name" onChange={(e) => setName(e.target.value)} placeholder="Inspector Ravi Kumar" required type="text" value={name} />
              </DarkField>

              <DarkField htmlFor="reg-email" label="Work email">
                <input className="field-dark" id="reg-email" onChange={(e) => setEmail(e.target.value)} placeholder="officer@ksp.gov.in" required type="email" value={email} />
              </DarkField>

              <DarkField htmlFor="reg-badge" label="Police badge / staff ID">
                <input className="field-dark" id="reg-badge" onChange={(e) => setBadgeId(e.target.value)} placeholder="BTP-2045-A" type="text" value={badgeId} />
              </DarkField>

              <DarkField htmlFor="reg-rank" label="Rank">
                <select className="field-dark" id="reg-rank" onChange={(e) => setRank(e.target.value)} title="Rank" value={rank}>
                  {RANKS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </DarkField>

              <DarkField htmlFor="reg-unit" label="Unit / station">
                <input className="field-dark" id="reg-unit" onChange={(e) => setUnit(e.target.value)} placeholder="BTP East Division" type="text" value={unitName} />
              </DarkField>

              <DarkField htmlFor="reg-pass" label="Password">
                <input className="field-dark" id="reg-pass" onChange={(e) => setPassword(e.target.value)} placeholder="Min 8 characters" required title="Password" type="password" value={password} />
              </DarkField>

              {error ? (
                <div className="rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/8 px-3 py-2.5 text-[12px] text-[#fca5a5]">
                  {error}
                </div>
              ) : null}

              <button className="btn-primary w-full justify-center py-2.5 text-[13px]" disabled={busy} type="submit">
                <ShieldCheck className="h-4 w-4" />
                {busy ? "Sending request…" : "Request field access"}
              </button>
            </form>

            <div className="mt-6 space-y-1.5 text-center text-[12px] text-[#3d5278]">
              <div>
                Traffic analyst?{" "}
                <Link className="text-[#a78bfa] hover:underline" href="/register/viewer">Register as viewer</Link>
              </div>
              <div>
                Already registered?{" "}
                <Link className="text-[#22d3ee] hover:underline" href="/login">Sign in</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

function DarkField({ children, htmlFor, label }: { children: React.ReactNode; htmlFor: string; label: string }) {
  return (
    <div>
      <label className="mb-2 block text-[12px] font-semibold text-[#7c9ab8]" htmlFor={htmlFor}>{label}</label>
      {children}
    </div>
  );
}
