"use client";

import { Menu, Radio } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { getCurrentUser } from "@/lib/auth";
import { roleShortLabel } from "@/lib/roles";
import type { UserRole } from "@/types/prediction";

type Tab = { href: string; label: string; roles: UserRole[] };

const TABS: Tab[] = [
  { href: "/dashboard/admin",      label: "Overview",     roles: ["admin"] },
  { href: "/dashboard/operator",   label: "Dispatch",     roles: ["admin"] },
  { href: "/dashboard/complaints", label: "Complaints",   roles: ["admin"] },
  { href: "/dashboard/access",     label: "Access",       roles: ["admin"] },
  { href: "/dashboard/personnel",  label: "Personnel",    roles: ["admin"] },
  { href: "/dashboard/field",      label: "Field Orders", roles: ["operator"] },
  { href: "/dashboard/viewer",     label: "Reports",      roles: ["viewer"] },
];

const ROLE_COLOR: Record<UserRole, string> = {
  admin:    "text-[#FFE600]",
  operator: "text-[#22D3EE]",
  viewer:   "text-[#A78BFA]",
};

export default function DashboardTopbar({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
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

  const roleColor = user?.role ? (ROLE_COLOR[user.role] ?? "text-[#FFE600]") : "text-[#FFE600]";

  return (
    <header className="fixed left-0 right-0 top-0 z-50 flex h-11 items-center border-b-2 border-[#252535] bg-[#08080F]/97 backdrop-blur-md px-4">

      {/* Mobile sidebar toggle */}
      <button
        className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded border-2 border-[#252535] text-[#444455] transition hover:border-[#FFE600] hover:text-[#FFE600] lg:hidden"
        onClick={onToggleSidebar}
        type="button"
        aria-label="Toggle sidebar"
      >
        <Menu className="h-3.5 w-3.5" />
      </button>

      {/* Brand */}
      <Link className="flex w-[160px] shrink-0 items-center gap-2.5 lg:w-[200px]" href={tabs[0]?.href ?? "/login"}>
        <div className="flex h-6 w-6 items-center justify-center rounded bg-[#FFE600]">
          <Radio className="h-3.5 w-3.5 text-[#08080F]" />
        </div>
        <div>
          <div className="font-mono text-[11px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</div>
          <div className="font-mono text-[8px] font-bold uppercase tracking-[0.16em] text-[#444455]">BLR-OPS</div>
        </div>
      </Link>

      {/* Tabs — scrollable on mobile */}
      <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto scrollbar-none lg:justify-center">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              className={`flex items-center gap-1.5 rounded border-2 px-3 py-1 text-[10px] font-black uppercase tracking-[0.1em] transition ${
                active
                  ? "border-[#FFE600]/25 bg-[#FFE600]/8 text-[#FFE600]"
                  : "border-transparent text-[#444455] hover:border-[#252535] hover:bg-[#0F0F1A] hover:text-[#8888A0]"
              }`}
              href={tab.href}
              key={tab.href}
            >
              {active && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#FFE600]" />}
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {/* Right side */}
      <div className="flex w-auto shrink-0 items-center justify-end gap-3 lg:w-[200px]">
        <div className="hidden text-right sm:block">
          <div className={`text-[10px] font-black uppercase tracking-[0.08em] ${roleColor}`}>
            {user?.role ? roleShortLabel(user.role) : "Police"}
          </div>
          <div className="font-mono text-[9px] truncate text-[#444455]">{user?.name ?? "Officer"}</div>
        </div>
        <div className="flex items-center gap-1.5 rounded border-2 border-[#252535] bg-[#0F0F1A] px-2.5 py-1">
          <span className="live-breathe h-1.5 w-1.5 rounded-full bg-[#FFE600]" />
          <span className="font-mono text-[10px] font-bold text-[#FFE600]">{time || "--:--:--"}</span>
        </div>
      </div>
    </header>
  );
}
