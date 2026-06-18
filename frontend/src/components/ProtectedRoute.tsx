"use client";

import { Loader2, Radio } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";

import { getDashboardForRole, validateSession } from "@/lib/auth";
import type { AuthUser, UserRole } from "@/types/prediction";

interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: ReactNode;
}

export default function ProtectedRoute({ allowedRoles, children }: ProtectedRouteProps) {
  const router         = useRouter();
  const pathname       = usePathname();
  const [user,         setUser]       = useState<AuthUser | null>(null);
  const [isChecking,   setIsChecking] = useState(true);
  const allowedRoleKey = allowedRoles.join("|");

  useEffect(() => {
    let isMounted = true;
    async function checkAccess() {
      const currentUser = await validateSession();
      if (!isMounted) return;
      if (!currentUser) { router.replace("/login"); return; }
      if (!allowedRoleKey.split("|").includes(currentUser.role)) {
        router.replace(getDashboardForRole(currentUser.role));
        return;
      }
      setUser(currentUser);
      setIsChecking(false);
    }
    checkAccess();
    return () => { isMounted = false; };
  }, [allowedRoleKey, pathname, router]);

  if (isChecking || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#0ea5c5] to-[#2d6ce0]">
          <Radio className="h-5 w-5 text-white" />
        </div>
        <Loader2 className="h-5 w-5 animate-spin text-[#22d3ee]" />
        <div className="mono-id text-[#3d5278]">Verifying session…</div>
      </div>
    );
  }

  return children;
}
