"use client";

import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { approveUser, listUsers, rejectUser } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { roleLabel } from "@/lib/roles";
import type { AuthUser } from "@/types/prediction";

export default function AccessRequestsPanel() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [rejectReasonByUser, setRejectReasonByUser] = useState<Record<string, string>>({});

  async function load() {
    setIsLoading(true);
    try {
      setUsers(await listUsers());
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(
    () => ({
      approved: users.filter((user) => user.approval_status === "approved"),
      pending: users.filter((user) => user.approval_status === "pending"),
      rejected: users.filter((user) => user.approval_status === "rejected")
    }),
    [users]
  );

  async function handleApprove(userId: string) {
    await approveUser(userId);
    setMessage("Access request approved.");
    await load();
  }

  async function handleReject(userId: string) {
    const reason = rejectReasonByUser[userId]?.trim();
    if (!reason) {
      setMessage("Enter a rejection reason before rejecting access.");
      return;
    }

    await rejectUser(userId, reason);
    setMessage("Access request rejected with reason.");
    setRejectReasonByUser((current) => ({ ...current, [userId]: "" }));
    await load();
  }

  if (isLoading) {
    return (
      <section className="light-card grid min-h-56 place-items-center">
        <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
      </section>
    );
  }

  return (
    <section className="light-card overflow-hidden">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-orange-600" />
          <h2 className="font-semibold text-slate-950">Access Requests</h2>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          Approve or reject new police personnel before they can log in to DRISHTI.
        </p>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Pending review
          </div>
          <div className="space-y-3">
            {grouped.pending.map((user) => (
              <div className="light-card reveal-up p-4" key={user.id}>
                <UserSummary user={user} />
                <label className="mt-4 block text-sm font-medium text-slate-700">
                  Rejection reason
                  <input
                    className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                    onChange={(event) =>
                      setRejectReasonByUser((current) => ({
                        ...current,
                        [user.id]: event.target.value
                      }))
                    }
                    placeholder="Example: Badge ID not found in unit records"
                    value={rejectReasonByUser[user.id] || ""}
                  />
                </label>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    onClick={() => handleApprove(user.id)}
                    type="button"
                  >
                    Approve
                  </button>
                  <button
                    className="rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                    onClick={() => handleReject(user.id)}
                    type="button"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {!grouped.pending.length ? (
              <div className="rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                No access requests pending review.
              </div>
            ) : null}
          </div>
        </div>

        <aside className="space-y-4">
          <StatusBox label="Pending" value={grouped.pending.length} />
          <StatusBox label="Approved" value={grouped.approved.length} />
          <StatusBox label="Rejected" value={grouped.rejected.length} />
          {message ? (
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              {message}
            </div>
          ) : null}
          <div className="rounded-md border border-slate-200 p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-950">
              <XCircle className="h-4 w-4 text-red-600" />
              Recent rejections
            </div>
            <div className="space-y-3">
              {grouped.rejected.slice(0, 4).map((user) => (
                <div className="rounded bg-slate-50 p-3" key={user.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-950">{user.name}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {user.rejection_reason || "No reason recorded"}
                      </div>
                    </div>
                    <button
                      className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50"
                      onClick={() => handleApprove(user.id)}
                      type="button"
                    >
                      Approve
                    </button>
                  </div>
                </div>
              ))}
              {!grouped.rejected.length ? (
                <div className="text-sm text-slate-500">No rejected requests.</div>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-slate-200 p-4">
            <div className="mb-3 text-sm font-semibold text-slate-950">
              Recently approved
            </div>
            <div className="space-y-3">
              {grouped.approved.slice(0, 4).map((user) => (
                <div className="rounded bg-slate-50 p-3" key={user.id}>
                  <div className="font-semibold text-slate-950">{user.name}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {roleLabel(user.role)} / {user.badge_id || "Badge pending"}
                  </div>
                </div>
              ))}
              {!grouped.approved.length ? (
                <div className="text-sm text-slate-500">No approved users yet.</div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

function UserSummary({ user }: { user: AuthUser }) {
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-slate-950">{user.name}</div>
          <div className="mt-1 text-xs text-slate-500">{user.email}</div>
        </div>
        <span className="rounded bg-orange-100 px-2 py-1 text-xs font-semibold text-orange-800">
          {roleLabel(user.role)}
        </span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-3">
        <span>Badge: {user.badge_id || "Pending"}</span>
        <span>Rank: {user.rank || "Pending"}</span>
        <span>Unit: {user.unit_name || "Pending"}</span>
      </div>
      {user.created_at ? (
        <div className="mt-2 text-xs text-slate-500">
          Requested {formatDateTime(user.created_at)}
        </div>
      ) : null}
    </div>
  );
}

function StatusBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-3xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}
