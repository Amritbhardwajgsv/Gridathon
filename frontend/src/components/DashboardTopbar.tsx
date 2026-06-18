"use client";

import { Radio } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { roleShortLabel } from "@/lib/roles";
import type { UserRole } from "@/types/prediction";

type Tab = { href: string; label: string; roles: UserRole[] };

const TABS: Tab[] = [
  { href: "/dashboard/admin",      label: "Overview",    roles: ["admin"] },
  { href: "/dashboard/operator",   label: "Dispatch",    roles: ["admin"] },
  { href: "/dashboard/complaints", label: "Complaints",  roles: ["admin"] },
  { href: "/dashboard/access",     label: "Access",      roles: ["admin"] },
  { href: "/dashboard/personnel",  label: "Personnel",   roles: ["admin"] },
  { href: "/dashboard/field",      label: "Field Orders",roles: ["operator"] },
  { href: "/dashboard/viewer",     label: "Reports",     roles: ["viewer"] },
];

const ROLE_COLOR: Record<UserRole, string> = {
  admin:    "text-[#22d3ee]",
  operator: "text-[#3b82f6]",
  viewer:   "text-[#a78bfa]",
};

export default function DashboardTopbar() {
  const pathname = usePathname();
  const user     = getCurrentUser();
  const [time, setTime] = useState("");

  useEffect(() => {
    const tick = () =>
      setTime(
        new Intl.DateTimeFormat("en-IN", {
          hour: "2-digit", minute: "2-digit", second: "2-digit",
          hour12: false, timeZone: "Asia/Kolkata",
        }).format(new Date())
      );
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const tabs = useMemo(
    () => TABS.filter((t) => user?.role && t.roles.includes(user.role)),
    [user?.role]
  );

  const roleColor = user?.role ? (ROLE_COLOR[user.role] ?? "text-[#22d3ee]") : "text-[#22d3ee]";

  return (
    <header className="fixed left-0 right-0 top-0 z-40 flex h-11 items-center border-b border-[#1c2e4a] bg-[#060c18]/95 backdrop-blur-md px-4">
      {/* Brand */}
      <Link className="flex w-[196px] items-center gap-2 shrink-0" href={tabs[0]?.href ?? "/login"}>
        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
          <Radio className="h-3.5 w-3.5 text-white" />
        </div>
        <div>
          <div className="font-mono text-[11px] font-bold tracking-[0.18em] text-[#22d3ee]">DRISHTI</div>
          <div className="mono-id leading-none text-[#3d5278]">BLR-OPS</div>
        </div>
      </Link>

      {/* Tabs */}
      <nav className="flex min-w-0 flex-1 items-center justify-center gap-0.5">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              className={`rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.07em] transition ${
                active
                  ? `bg-[#22d3ee]/10 text-[#22d3ee] border border-[#22d3ee]/25`
                  : "text-[#3d5278] hover:bg-[#0d1629] hover:text-[#7c9ab8]"
              }`}
              href={tab.href}
              key={tab.href}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex w-[196px] shrink-0 items-center justify-end gap-3">
        <div className="hidden text-right sm:block">
          <div className={`text-[11px] font-semibold ${roleColor}`}>
            {user?.role ? roleShortLabel(user.role) : "Police"}
          </div>
          <div className="mono-id truncate text-[#3d5278]">{user?.name ?? "Officer"}</div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#22d3ee]" />
          <span className="mono-id text-[#22d3ee]">{time || "--:--:--"}</span>
        </div>
      </div>
    </header>
  );
}
