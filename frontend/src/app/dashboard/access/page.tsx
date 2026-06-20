"use client";

import { Loader2, Radio } from "lucide-react";
import dynamic from "next/dynamic";

const AccessRequestsPanel = dynamic(() => import("@/components/AccessRequestsPanel"), {
  loading: () => <div className="flex h-48 items-center justify-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />Loading…</div>,
});
import ProtectedRoute from "@/components/ProtectedRoute";

export default function AccessRequestsPage() {
  return (
    <ProtectedRoute allowedRoles={["admin"]}>
      <div className="min-h-screen bg-slate-100 text-slate-950">
        <section className="ops-surface border-b border-slate-800 px-5 py-7 text-white md:px-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-orange-300">
            <Radio className="h-4 w-4" />
            Command Centre
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight md:text-4xl">
            Police access requests
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
            Review new personnel requests, approve valid badges, or reject with a clear reason.
          </p>
        </section>

        <section className="px-5 py-6 md:px-8">
          <AccessRequestsPanel />
        </section>
      </div>
    </ProtectedRoute>
  );
}
