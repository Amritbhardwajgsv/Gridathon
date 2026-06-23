"use client";

import { useState } from "react";
import type { ReactNode } from "react";

import DashboardTopbar from "@/components/DashboardTopbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ProtectedRoute allowedRoles={["admin", "operator", "viewer"]}>
      <div className="min-h-screen bg-[#060c18] pt-11 text-[#dde8f5]">
        <DashboardTopbar onToggleSidebar={() => setSidebarOpen((o) => !o)} />
        <div className="flex min-h-[calc(100vh-44px)]">
          <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          {/* Mobile backdrop */}
          {sidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/60 lg:hidden"
              onClick={() => setSidebarOpen(false)}
            />
          )}
          <main className="min-w-0 flex-1 overflow-y-auto p-4 md:p-5">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

