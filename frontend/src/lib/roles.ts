import type { UserRole } from "@/types/prediction";

export const roleConfig: Record<
  UserRole,
  {
    dashboardPath: string;
    label: string;
    shortLabel: string;
  }
> = {
  admin: {
    dashboardPath: "/dashboard/admin",
    label: "Command Centre",
    shortLabel: "Centre"
  },
  operator: {
    dashboardPath: "/dashboard/field",
    label: "Field Officer",
    shortLabel: "Field"
  },
  viewer: {
    dashboardPath: "/dashboard/viewer",
    label: "Police Review",
    shortLabel: "Review"
  }
};

export function roleLabel(role: UserRole): string {
  return roleConfig[role].label;
}

export function roleShortLabel(role: UserRole): string {
  return roleConfig[role].shortLabel;
}

/** Rank seniority — lower number = more senior. Used for sorting personnel lists. */
export const RANK_ORDER: Record<string, number> = {
  DCP: 0, ACP: 1, Inspector: 2, SI: 3, ASI: 4, "Head Constable": 5, Constable: 6,
};

