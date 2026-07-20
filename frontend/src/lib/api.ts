import axios from "axios";
import { getInitData } from "./telegram";

// API client for the existing Express backend. Sends the signed Telegram initData
// on every request; the backend verifies it (HMAC) and authorizes the user.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8787",
  timeout: 20_000,
});

api.interceptors.request.use((cfg) => {
  const initData = getInitData();
  if (initData) {
    (cfg.headers as Record<string, string>)["x-telegram-init-data"] = initData;
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
