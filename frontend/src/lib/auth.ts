import api from "@/lib/api";
import { roleConfig } from "@/lib/roles";
import type {
  AuthUser,
  LoginPayload,
  PredictionHistoryItem,
  RegisterPayload,
  TokenResponse,
  UserRole
} from "@/types/prediction";

const TOKEN_STORAGE_KEY = "drishti_access_token";
const USER_STORAGE_KEY = "drishti_user";
const HISTORY_STORAGE_KEY = "prediction_history";

const isBrowser = typeof window !== "undefined";

export function getDashboardForRole(role: UserRole): string {
  return roleConfig[role].dashboardPath;
}

export function getAccessToken(): string | null {
  if (!isBrowser) {
    return null;
  }

  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function getCurrentUser(): AuthUser | null {
  if (!isBrowser) {
    return null;
  }

  const storedUser = window.localStorage.getItem(USER_STORAGE_KEY);
  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as AuthUser;
  } catch {
    clearSession();
    return null;
  }
}

export async function loginUser(payload: LoginPayload): Promise<AuthUser> {
  const response = await api.post<TokenResponse>("/auth/login", payload);
  storeSession(response.data);
  return response.data.user;
}

export async function registerUser(payload: RegisterPayload): Promise<AuthUser> {
  const response = await api.post<AuthUser>("/auth/register", payload);
  return response.data;
}

export async function fetchCurrentUser(): Promise<AuthUser> {
  const response = await api.get<AuthUser>("/auth/me");
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.data));
  return response.data;
}

export async function validateSession(): Promise<AuthUser | null> {
  if (!getAccessToken()) {
    clearSession();
    return null;
  }

  try {
    return await fetchCurrentUser();
  } catch {
    clearSession();
    return null;
  }
}

export async function logoutUser(): Promise<void> {
  // Tell the backend to blacklist the JWT in Redis first.
  // Fire-and-forget: even if the request fails the local session is cleared.
  try {
    const token = getAccessToken();
    if (token) {
      await api.post("/auth/logout");
    }
  } catch {
    // network error or already-expired token — clear locally regardless
  } finally {
    clearSession();
  }
}

function storeSession(response: TokenResponse): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, response.access_token);
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(response.user));
}

function clearSession(): void {
  if (!isBrowser) {
    return;
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  window.localStorage.removeItem(USER_STORAGE_KEY);
}

export function getPredictionHistory(): PredictionHistoryItem[] {
  if (!isBrowser) {
    return [];
  }

  const storedHistory = window.localStorage.getItem(HISTORY_STORAGE_KEY);
  if (!storedHistory) {
    return [];
  }

  try {
    return JSON.parse(storedHistory) as PredictionHistoryItem[];
  } catch {
    window.localStorage.removeItem(HISTORY_STORAGE_KEY);
    return [];
  }
}

export function savePredictionHistoryItem(item: PredictionHistoryItem): void {
  const history = getPredictionHistory();
  window.localStorage.setItem(
    HISTORY_STORAGE_KEY,
    JSON.stringify([item, ...history].slice(0, 100))
  );
}
