import axios from "axios";

import type {
  CitizenGrievance,
  CitizenGrievancePayload,
  AuthUser,
  DeploymentOrder,
  DeploymentOrderPayload,
  DeploymentStatusUpdatePayload,
  FieldAssignment,
  GrievanceStatusUpdatePayload,
  OperationsSummary,
  PersonnelLocationUpdatePayload,
  PersonnelLocationUpdateResponse,
  PolicePersonnel,
  PolicePersonnelPayload,
  PredictImpactPayload,
  PredictImpactResponse
} from "@/types/prediction";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  if (typeof window === "undefined") {
    return config;
  }

  const token = window.localStorage.getItem("drishti_access_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

export async function predictImpact(
  payload: PredictImpactPayload
): Promise<PredictImpactResponse> {
  const response = await api.post<PredictImpactResponse>("/predict-impact", payload);
  return response.data;
}

export async function submitCitizenGrievance(
  payload: CitizenGrievancePayload
): Promise<CitizenGrievance> {
  const response = await api.post<CitizenGrievance>("/citizen/grievances", payload);
  return response.data;
}

export async function trackCitizenGrievance(
  trackingId: string
): Promise<CitizenGrievance> {
  const response = await api.get<CitizenGrievance>(
    `/citizen/grievances/${encodeURIComponent(trackingId)}`
  );
  return response.data;
}

export async function listCitizenGrievances(): Promise<CitizenGrievance[]> {
  const response = await api.get<{ items: CitizenGrievance[] }>("/police/grievances");
  return response.data.items;
}

export async function getOperationsSummary(): Promise<OperationsSummary> {
  const response = await api.get<OperationsSummary>("/operations/summary");
  return response.data;
}

export async function listUsers(): Promise<AuthUser[]> {
  const response = await api.get<{ items: AuthUser[] }>("/admin/users");
  return response.data.items;
}

export async function approveUser(userId: string): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/users/${userId}/approve`);
  return response.data;
}

export async function rejectUser(userId: string, reason: string): Promise<AuthUser> {
  const response = await api.post<AuthUser>(`/admin/users/${userId}/reject`, {
    reason
  });
  return response.data;
}

export async function createPersonnel(
  payload: PolicePersonnelPayload
): Promise<PolicePersonnel> {
  const response = await api.post<PolicePersonnel>("/admin/personnel", payload);
  return response.data;
}

export async function listPersonnel(): Promise<PolicePersonnel[]> {
  const response = await api.get<{ items: PolicePersonnel[] }>("/police/personnel");
  return response.data.items;
}

export async function removePersonnel(personnelId: string): Promise<void> {
  await api.delete(`/admin/personnel/${personnelId}`);
}

export async function updatePersonnelLocation(
  badgeId: string,
  payload: PersonnelLocationUpdatePayload
): Promise<PersonnelLocationUpdateResponse> {
  const response = await api.post<PersonnelLocationUpdateResponse>(
    `/field/personnel/${encodeURIComponent(badgeId)}/location`,
    payload
  );
  return response.data;
}

export async function updateMyPersonnelLocation(
  payload: PersonnelLocationUpdatePayload
): Promise<PersonnelLocationUpdateResponse> {
  const response = await api.post<PersonnelLocationUpdateResponse>(
    "/field/me/location",
    payload
  );
  return response.data;
}

export async function listMyFieldAssignments(): Promise<FieldAssignment[]> {
  const response = await api.get<{ items: FieldAssignment[] }>("/field/me/assignments");
  return response.data.items;
}

export async function createDeploymentOrder(
  payload: DeploymentOrderPayload
): Promise<DeploymentOrder> {
  const response = await api.post<DeploymentOrder>("/police/deployments", payload);
  return response.data;
}

export async function listDeploymentOrders(): Promise<DeploymentOrder[]> {
  const response = await api.get<{ items: DeploymentOrder[] }>("/police/deployments");
  return response.data.items;
}

export async function updateDeploymentStatus(
  orderId: string,
  payload: DeploymentStatusUpdatePayload
): Promise<DeploymentOrder> {
  const response = await api.patch<DeploymentOrder>(
    `/police/deployments/${encodeURIComponent(orderId)}/status`,
    payload
  );
  return response.data;
}

export async function updateGrievanceStatus(
  grievanceId: string,
  payload: GrievanceStatusUpdatePayload
): Promise<CitizenGrievance> {
  const response = await api.patch<CitizenGrievance>(
    `/police/grievances/${encodeURIComponent(grievanceId)}/status`,
    payload
  );
  return response.data;
}

export async function officerLodgeGrievance(
  payload: CitizenGrievancePayload
): Promise<CitizenGrievance> {
  const response = await api.post<CitizenGrievance>("/field/me/report", payload);
  return response.data;
}

export type RouteResult = {
  coordinates: [number, number][];
  duration_minutes: number | null;
  distance_km: number | null;
  fallback?: boolean;
};

export async function getFieldRoute(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number
): Promise<RouteResult> {
  const response = await api.get<RouteResult>("/field/route", {
    params: { from_lat: fromLat, from_lng: fromLng, to_lat: toLat, to_lng: toLng },
  });
  return response.data;
}

export default api;
