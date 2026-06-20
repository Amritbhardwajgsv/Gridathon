"use client";

import { ArrowLeft, ArrowRight, Eye, Radio } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { registerUser } from "@/lib/auth";

export default function ViewerRegisterPage() {
  const [name,       setName]   = useState("");
  const [email,      setEmail]  = useState("");
  const [password,   setPass]   = useState("Drishti@123");
  const [department, setDept]   = useState("");
  const [reason,     setReason] = useState("");
  const [error,      setError]  = useState("");
  const [busy,       setBusy]   = useState(false);
  const [done,       setDone]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await registerUser({
        name: name || email.split("@")[0],
        email,
        password,
        role: "viewer",
        unit_name: department || undefined,
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

        <div className="mb-10">
          <div className="section-kicker mb-3 text-[#A78BFA]">+ Police Review Access</div>
          <h1 className="text-[34px] font-black uppercase leading-[1.0] tracking-[-0.01em] text-[#F0F0F8]">
            Request viewer<br />access.
          </h1>
          <p className="mt-4 text-[13px] leading-6 text-[#8888A0]">
            Read-only access to traffic analytics, severity trends, and operational summaries.
            No dispatch or personnel management.
          </p>
        </div>

        {done ? (
          <div className="browser-card border-2 border-[#A78BFA]/30">
            <div className="browser-card-header border-b-2 border-[#A78BFA]/30">
              <span className="browser-dot browser-dot-red" />
              <span className="browser-dot browser-dot-yellow" />
              <span className="browser-dot browser-dot-green" />
              <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#A78BFA]">REQUEST SUBMITTED</span>
            </div>
            <div className="p-8 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded bg-[#A78BFA]/15">
                <Eye className="h-7 w-7 text-[#A78BFA]" />
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
              <span className="ml-3 font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">VIEWER REGISTRATION</span>
            </div>
            <div className="p-6">
              <form className="space-y-4" onSubmit={handleSubmit}>
                <FormField htmlFor="vr-name" label="Full name">
                  <input className="field-dark" id="vr-name" onChange={(e) => setName(e.target.value)} placeholder="Dr. Priya Sharma" required type="text" value={name} />
                </FormField>

                <FormField htmlFor="vr-email" label="Work email">
                  <input className="field-dark" id="vr-email" onChange={(e) => setEmail(e.target.value)} placeholder="analyst@bbmp.gov.in" required type="email" value={email} />
                </FormField>

                <FormField htmlFor="vr-dept" label="Department / organisation">
                  <input className="field-dark" id="vr-dept" onChange={(e) => setDept(e.target.value)} placeholder="BBMP Traffic Engineering Cell" type="text" value={department} />
                </FormField>

                <FormField htmlFor="vr-reason" label="Reason for access">
                  <textarea
                    className="field-dark"
                    id="vr-reason"
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly describe why you need access to DRISHTI traffic data…"
                    rows={3}
                    value={reason}
                  />
                </FormField>

                <FormField htmlFor="vr-pass" label="Password">
                  <input className="field-dark" id="vr-pass" onChange={(e) => setPass(e.target.value)} placeholder="Min 8 characters" required title="Password" type="password" value={password} />
                </FormField>

                {error ? (
                  <div className="rounded border-2 border-[#EF4444]/30 bg-[#EF4444]/8 px-3 py-2.5 text-[12px] text-[#FCA5A5]">
                    {error}
                  </div>
                ) : null}

                <button
                  className="inline-flex w-full items-center justify-center gap-2 rounded border-2 border-[#A78BFA] bg-[#A78BFA] py-3 text-[12px] font-black uppercase tracking-[0.08em] text-[#08080F] transition hover:opacity-90 disabled:opacity-60"
                  disabled={busy}
                  type="submit"
                >
                  <Eye className="h-4 w-4" />
                  {busy ? "Sending request…" : "Request viewer access"}
                  {!busy && <ArrowRight className="h-4 w-4 ml-auto" />}
                </button>
              </form>

              <div className="mt-6 space-y-2 border-t-2 border-[#252535] pt-5 text-center text-[12px] text-[#444455]">
                <div>
                  Field officer?{" "}
                  <Link className="font-bold text-[#FFE600] hover:underline" href="/register">Register as officer</Link>
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
