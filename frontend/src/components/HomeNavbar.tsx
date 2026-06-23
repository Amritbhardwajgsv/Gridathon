"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Menu, Radio, X } from "lucide-react";

export default function HomeNavbar() {
  const [open, setOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 border-b-2 border-[#252535] bg-[#08080F]/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link className="flex items-center gap-3" href="/">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-[#FFE600]">
            <Radio className="h-4 w-4 text-[#08080F]" />
          </div>
          <div>
            <div className="font-mono text-[13px] font-bold tracking-[0.22em] text-[#FFE600]">DRISHTI</div>
            <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#444455]">Bengaluru Police · Traffic Ops</div>
          </div>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-1 md:flex">
          <Link
            className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8888A0] transition hover:text-[#F0F0F8]"
            href="/citizen/grievance"
          >
            Report
          </Link>
          <Link
            className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8888A0] transition hover:text-[#F0F0F8]"
            href="/citizen/track"
          >
            Track
          </Link>
          <Link
            className="px-3 py-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8888A0] transition hover:text-[#F0F0F8]"
            href="/citizen/hotspots"
          >
            Hotspots
          </Link>
          <Link
            className="ml-2 inline-flex items-center gap-1.5 rounded border-2 border-[#252535] px-4 py-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[#8888A0] transition hover:border-[#FFE600] hover:text-[#FFE600]"
            href="/register"
          >
            Request Access
          </Link>
          <Link className="ml-1 btn-primary text-[11px]" href="/login">
            Police Login
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="flex h-9 w-9 items-center justify-center rounded border-2 border-[#252535] text-[#8888A0] transition hover:border-[#FFE600] hover:text-[#FFE600] md:hidden"
          onClick={() => setOpen((o) => !o)}
          type="button"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t-2 border-[#252535] bg-[#08080F] px-6 pb-5 pt-3 md:hidden">
          <div className="flex flex-col gap-0.5">
            <Link
              className="rounded px-3 py-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[#8888A0] transition hover:bg-[#0F0F1A] hover:text-[#F0F0F8]"
              href="/citizen/grievance"
              onClick={() => setOpen(false)}
            >
              Report Incident
            </Link>
            <Link
              className="rounded px-3 py-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[#8888A0] transition hover:bg-[#0F0F1A] hover:text-[#F0F0F8]"
              href="/citizen/track"
              onClick={() => setOpen(false)}
            >
              Track Complaint
            </Link>
            <Link
              className="rounded px-3 py-3 text-[13px] font-bold uppercase tracking-[0.06em] text-[#8888A0] transition hover:bg-[#0F0F1A] hover:text-[#F0F0F8]"
              href="/citizen/hotspots"
              onClick={() => setOpen(false)}
            >
              Traffic Hotspots
            </Link>
            <div className="mt-3 flex flex-col gap-2 border-t-2 border-[#252535] pt-3">
              <Link
                className="btn-ghost w-full justify-center py-3 text-[13px]"
                href="/register"
                onClick={() => setOpen(false)}
              >
                Request Access
              </Link>
              <Link
                className="btn-primary w-full justify-center py-3 text-[13px]"
                href="/login"
                onClick={() => setOpen(false)}
              >
                Police Login
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
