"use client";

import type { ReactNode } from "react";

import DashboardTopbar from "@/components/DashboardTopbar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Sidebar from "@/components/Sidebar";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={["admin", "operator", "viewer"]}>
      <div className="min-h-screen bg-[#060c18] pt-11 text-[#dde8f5]">
        <DashboardTopbar />
        <div className="flex min-h-[calc(100vh-44px)]">
          <Sidebar />
          <main className="min-w-0 flex-1 overflow-y-auto p-5">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

