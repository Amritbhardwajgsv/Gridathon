"use client";

import { ArrowLeft, Eye, Radio } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

import { registerUser } from "@/lib/auth";

export default function ViewerRegisterPage() {
  const router     = useRouter();
  const [name,       setName]   = useState("");
  const [email,      setEmail]  = useState("");
  const [password,   setPass]   = useState("Drishti@123");
  const [department, setDept]   = useState("");
  const [reason,     setReason] = useState("");
  const [error,      setError]  = useState("");
  const [busy,       setBusy]   = useState(false);
  const [done,       setDone]   = useState(false);

  async function handleSubmit(e: FormEvent) {
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
          <div className="section-kicker mb-3 text-[#a78bfa]">Police Review Access</div>
          <h1 className="text-[28px] font-bold text-[#f0f6ff]">Request viewer access</h1>
          <p className="mx-auto mt-3 max-w-md text-[13px] leading-6 text-[#7c9ab8]">
            Read-only access to traffic analytics, severity trends, and operational summaries.
            No dispatch or personnel management.
          </p>
        </div>

        {done ? (
          <div className="cmd-card border-[#a78bfa]/25 p-8 text-center">
            <Eye className="mx-auto h-10 w-10 text-[#a78bfa]" />
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
              <DarkField htmlFor="vr-name" label="Full name">
                <input className="field-dark" id="vr-name" onChange={(e) => setName(e.target.value)} placeholder="Dr. Priya Sharma" required type="text" value={name} />
              </DarkField>

              <DarkField htmlFor="vr-email" label="Work email">
                <input className="field-dark" id="vr-email" onChange={(e) => setEmail(e.target.value)} placeholder="analyst@bbmp.gov.in" required type="email" value={email} />
              </DarkField>

              <DarkField htmlFor="vr-dept" label="Department / organisation">
                <input className="field-dark" id="vr-dept" onChange={(e) => setDept(e.target.value)} placeholder="BBMP Traffic Engineering Cell" type="text" value={department} />
              </DarkField>

              <DarkField htmlFor="vr-reason" label="Reason for access">
                <textarea
                  className="field-dark"
                  id="vr-reason"
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Briefly describe why you need access to DRISHTI traffic data…"
                  rows={3}
                  value={reason}
                />
              </DarkField>

              <DarkField htmlFor="vr-pass" label="Password">
                <input className="field-dark" id="vr-pass" onChange={(e) => setPass(e.target.value)} placeholder="Min 8 characters" required title="Password" type="password" value={password} />
              </DarkField>

              {error ? (
                <div className="rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/8 px-3 py-2.5 text-[12px] text-[#fca5a5]">
                  {error}
                </div>
              ) : null}

              <button className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#a78bfa] py-2.5 text-[13px] font-semibold text-[#060c18] transition hover:opacity-90 disabled:opacity-60" disabled={busy} type="submit">
                <Eye className="h-4 w-4" />
                {busy ? "Sending request…" : "Request viewer access"}
              </button>
            </form>

            <div className="mt-6 space-y-1.5 text-center text-[12px] text-[#3d5278]">
              <div>
                Field officer?{" "}
                <Link className="text-[#22d3ee] hover:underline" href="/register">Register as officer</Link>
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
