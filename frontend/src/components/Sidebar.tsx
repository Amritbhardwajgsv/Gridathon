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

const ROLE_COLOR: Record<UserRole, string> = {
  admin:    "text-[#FFE600]",
  operator: "text-[#22D3EE]",
  viewer:   "text-[#A78BFA]",
};

const ROLE_BG: Record<UserRole, string> = {
  admin:    "bg-[#FFE600]/10 border-[#FFE600]/25",
  operator: "bg-[#22D3EE]/10 border-[#22D3EE]/25",
  viewer:   "bg-[#A78BFA]/10 border-[#A78BFA]/25",
};

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const user     = getCurrentUser();
  const isAdmin  = user?.role === "admin";

  const items = NAV.filter((n) => user?.role && n.roles.includes(user.role));
  const roleColor = user?.role ? (ROLE_COLOR[user.role] ?? ROLE_COLOR.operator) : ROLE_COLOR.operator;
  const roleBg    = user?.role ? (ROLE_BG[user.role] ?? ROLE_BG.operator) : ROLE_BG.operator;

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
    <aside className="sticky top-11 flex h-[calc(100vh-44px)] w-[200px] shrink-0 flex-col border-r-2 border-[#252535] bg-[#08080F]">

      {/* User card */}
      <div className="border-b-2 border-[#252535] p-3">
        <div className={`rounded border-2 ${roleBg} px-3 py-3`}>
          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#444455]">Role</div>
          <div className={`mt-1 text-[12px] font-black uppercase tracking-[0.04em] ${roleColor}`}>
            {user?.role ? roleLabel(user.role) : "Police"}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-[#8888A0]">{user?.name ?? "Officer"}</div>
          <div className="mt-1.5 font-mono text-[9px] text-[#444455]">{user?.badge_id ?? "BADGE PENDING"}</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-5">
        {GROUPS.map((group) => {
          const groupItems = items.filter((n) => n.group === group);
          if (!groupItems.length && group !== "System") return null;
          return (
            <div key={group}>
              <div className="mb-2 px-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#444455]">{group}</div>
              <div className="space-y-0.5">
                {groupItems.map((item) => {
                  const Icon   = item.icon;
                  const active = pathname.startsWith(item.href);
                  return (
                    <Link
                      className={`flex h-8 items-center gap-2.5 rounded border-2 px-2.5 text-[11px] font-bold uppercase tracking-[0.04em] transition ${
                        active
                          ? "border-[#FFE600]/25 bg-[#FFE600]/8 text-[#FFE600]"
                          : "border-transparent text-[#444455] hover:border-[#252535] hover:bg-[#0F0F1A] hover:text-[#8888A0]"
                      }`}
                      href={item.href}
                      key={item.href}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${active ? "text-[#FFE600]" : "text-[#252535]"}`} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFE600]" />}
                    </Link>
                  );
                })}

                {group === "System" && (
                  <button
                    className="flex h-8 w-full items-center gap-2.5 rounded border-2 border-transparent px-2.5 text-left text-[11px] font-bold uppercase tracking-[0.04em] text-[#444455] transition hover:border-[#EF4444]/25 hover:bg-[#EF4444]/8 hover:text-[#EF4444]"
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

      {/* Officer quick-search (admin only) */}
      {isAdmin && (
        <div className="border-t-2 border-[#252535] p-3">
          <div className="mb-2 flex items-center gap-1 text-[9px] font-black uppercase tracking-[0.18em] text-[#444455]">
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
                <div className="rounded border-2 border-[#252535] bg-[#0F0F1A] px-2.5 py-2" key={o.id}>
                  <div className="flex items-start justify-between gap-1">
                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-bold text-[#F0F0F8]">{o.name}</div>
                      <div className="font-mono text-[9px] text-[#444455]">{o.badge_id} · {o.rank}</div>
                    </div>
                    <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-black uppercase ${
                      o.is_available ? "border-[#10B981]/30 bg-[#10B981]/10 text-[#10B981]" : "border-[#EF4444]/30 bg-[#EF4444]/10 text-[#EF4444]"
                    }`}>
                      {o.is_available ? "Free" : "Busy"}
                    </span>
                  </div>
                  {o.last_location_at ? (
                    <div className="font-mono mt-1 text-[9px] text-[#444455]">
                      GPS {new Date(o.last_location_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  ) : (
                    <div className="font-mono mt-1 text-[9px] text-[#444455]">No GPS</div>
                  )}
                </div>
              )) : (
                <div className="rounded border-2 border-[#252535] px-2.5 py-2 text-[11px] text-[#444455]">
                  Not found.{" "}
                  <Link className="text-[#FFE600] hover:underline" href="/dashboard/personnel">Add registry</Link>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-1 font-mono text-[9px] text-[#444455]">
              {allPersonnel.length} officer{allPersonnel.length !== 1 ? "s" : ""} registered
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
