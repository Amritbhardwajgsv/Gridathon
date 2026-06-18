"use client";

import {
  BarChart3,
  ClipboardList,
  LogOut,
  MapPinned,
  Radio,
  Search,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { listPersonnel } from "@/lib/api";
import { getCurrentUser, logoutUser } from "@/lib/auth";
import { roleLabel } from "@/lib/roles";
import type { PolicePersonnel, UserRole } from "@/types/prediction";

type NavItem = {
  group: "Operations" | "Personnel" | "System";
  href: string;
  icon: LucideIcon;
  label: string;
  roles: UserRole[];
  count?: string;
  urgent?: boolean;
};

const NAV: NavItem[] = [
  { group: "Operations", href: "/dashboard/admin",      icon: Radio,         label: "Overview",           roles: ["admin"] },
  { group: "Operations", href: "/dashboard/operator",   icon: ShieldCheck,   label: "Duty Dispatch",      roles: ["admin"] },
  { group: "Operations", href: "/dashboard/complaints", icon: ClipboardList, label: "Complaint Queue",    roles: ["admin"] },
  { group: "Operations", href: "/dashboard/field",      icon: MapPinned,     label: "Field Orders",       roles: ["operator"] },
  { group: "Operations", href: "/dashboard/viewer",     icon: BarChart3,     label: "Reports",            roles: ["viewer"] },
  { group: "Personnel",  href: "/dashboard/access",     icon: UserCheck,     label: "Access Requests",    roles: ["admin"] },
  { group: "Personnel",  href: "/dashboard/personnel",  icon: Users,         label: "Personnel Registry", roles: ["admin"] },
];

const GROUPS: NavItem["group"][] = ["Operations", "Personnel", "System"];

const ROLE_ACCENT: Record<UserRole, { text: string; bg: string; border: string }> = {
  admin:    { text: "text-[#22d3ee]",  bg: "bg-[#22d3ee]/10",  border: "border-[#22d3ee]/25" },
  operator: { text: "text-[#3b82f6]",  bg: "bg-[#3b82f6]/10",  border: "border-[#3b82f6]/25" },
  viewer:   { text: "text-[#a78bfa]",  bg: "bg-[#a78bfa]/10",  border: "border-[#a78bfa]/25" },
};

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getCurrentUser();
  const isAdmin  = user?.role === "admin";

  const items = NAV.filter((n) => user?.role && n.roles.includes(user.role));
  const accent = user?.role ? (ROLE_ACCENT[user.role] ?? ROLE_ACCENT.operator) : ROLE_ACCENT.operator;

  const [allPersonnel, setAllPersonnel] = useState<PolicePersonnel[]>([]);
  const [search,       setSearch]       = useState("");
  const searchRef                       = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAdmin) return;
    listPersonnel().then(setAllPersonnel).catch(() => {});
    const id = window.setInterval(() => listPersonnel().then(setAllPersonnel).catch(() => {}), 30_000);
    return () => window.clearInterval(id);
  }, [isAdmin]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return allPersonnel
      .filter((p) =>
        p.badge_id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        (p.zone ?? "").toLowerCase().includes(q) ||
        p.rank.toLowerCase().includes(q)
      )
      .slice(0, 5);
  }, [search, allPersonnel]);

  return (
    <aside className="sticky top-11 flex h-[calc(100vh-44px)] w-[196px] shrink-0 flex-col border-r border-[#1c2e4a] bg-[#060c18]">

      {/* User card */}
      <div className="border-b border-[#1c2e4a] p-3">
        <div className={`rounded-lg border ${accent.border} ${accent.bg} px-3 py-2.5`}>
          <div className="section-kicker mb-1">Role</div>
          <div className={`text-[12px] font-bold ${accent.text}`}>
            {user?.role ? roleLabel(user.role) : "Police"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[#7c9ab8]">{user?.name ?? "Officer"}</div>
          <div className="mono-id mt-1.5 text-[#3d5278]">{user?.badge_id ?? "BADGE PENDING"}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {GROUPS.map((group) => {
          const groupItems = items.filter((n) => n.group === group);
          if (!groupItems.length && group !== "System") return null;
          return (
            <div key={group}>
              <div className="section-kicker mb-2 px-1">{group}</div>
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon   = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      className={`flex h-8 items-center gap-2 rounded-lg border px-2.5 text-[12px] font-medium transition ${
                        active
                          ? `border-[#22d3ee]/20 bg-[#22d3ee]/8 text-[#22d3ee]`
                          : "border-transparent text-[#3d5278] hover:bg-[#0d1629] hover:text-[#7c9ab8]"
                      }`}
                      href={item.href}
                      key={item.href}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#22d3ee]" : "text-[#1c2e4a]"}`} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    </Link>
                  );
                })}

                {group === "System" && (
                  <button
                    className="flex h-8 w-full items-center gap-2 rounded-lg border border-transparent px-2.5 text-left text-[12px] font-medium text-[#3d5278] transition hover:bg-[#0d1629] hover:text-[#ef4444]"
                    onClick={async () => { await logoutUser(); router.replace("/login"); }}
                    type="button"
                  >
                    <LogOut className="h-3.5 w-3.5 shrink-0" />
                    Sign out
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Officer quick-search (admin) */}
      {isAdmin && (
        <div className="border-t border-[#1c2e4a] p-3">
          <div className="section-kicker mb-2 flex items-center gap-1">
            <Search className="h-3 w-3" />Officer Lookup
          </div>
          <input
            ref={searchRef}
            className="field-dark py-1.5 text-[11px]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Badge ID or name…"
            type="text"
            value={search}
          />
          {search.trim() ? (
            <div className="mt-2 space-y-1">
              {results.length ? results.map((o) => (
                <div className="rounded-lg border border-[#1c2e4a] bg-[#0d1629] px-2.5 py-2" key={o.id}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-semibold text-[#f0f6ff]">{o.name}</div>
                      <div className="mono-id truncate">{o.badge_id} · {o.rank}</div>
                    </div>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                      o.is_available ? "bg-[#10b981]/15 text-[#10b981]" : "bg-[#ef4444]/15 text-[#ef4444]"
                    }`}>
                      {o.is_available ? "Free" : "Busy"}
                    </span>
                  </div>
                  {o.last_location_at ? (
                    <div className="mono-id mt-1 text-[9px] text-[#3d5278]">
                      GPS {new Date(o.last_location_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  ) : (
                    <div className="mono-id mt-1 text-[9px] text-[#3d5278]">No GPS</div>
                  )}
                </div>
              )) : (
                <div className="rounded-lg border border-[#1c2e4a] px-2.5 py-2 text-[11px] text-[#3d5278]">
                  Not found.{" "}
                  <Link className="text-[#22d3ee] hover:underline" href="/dashboard/personnel">Add registry</Link>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 text-[10px] text-[#3d5278]">
              {allPersonnel.length} officer{allPersonnel.length !== 1 ? "s" : ""} registered
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
