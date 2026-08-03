import axios from "axios";
import { getInitData } from "./telegram";

// API client for the existing Express backend. Sends the signed Telegram initData
// on every request; the backend verifies it (HMAC) and authorizes the user.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8787",
  timeout: 20_000,
  withCredentials: true,
});

let adminCsrfToken = "";

export function setAdminCsrfToken(token: string): void {
  adminCsrfToken = token || "";
}

export function clearAdminCsrfToken(): void {
  adminCsrfToken = "";
}

api.interceptors.request.use((cfg) => {
  const initData = getInitData();
  if (initData) {
    (cfg.headers as Record<string, string>)["x-telegram-init-data"] = initData;
  }
  const url = String(cfg.url || "");
  const method = String(cfg.method || "get").toUpperCase();
  if (adminCsrfToken && url.startsWith("/api/admin") && !["GET", "HEAD", "OPTIONS"].includes(method)) {
    (cfg.headers as Record<string, string>)["x-admin-csrf"] = adminCsrfToken;
  }
  return cfg;
});

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: string } | undefined;
    return data?.message || data?.error || err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
