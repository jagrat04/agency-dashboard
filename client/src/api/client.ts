import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { User } from "../types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

export const api = axios.create({ baseURL: `${API_URL}/api`, withCredentials: true });

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

interface RefreshResult {
  accessToken: string;
  user: User;
}

async function performRefresh(): Promise<RefreshResult | null> {
  try {
    const res = await axios.post(`${API_URL}/api/auth/refresh`, {}, { withCredentials: true });
    setAccessToken(res.data.accessToken);
    return res.data;
  } catch {
    setAccessToken(null);
    return null;
  }
}

// Dedupe concurrent callers (e.g. React StrictMode's double-invoked effect, or
// several requests 401ing at once) onto a single in-flight refresh.
let refreshPromise: Promise<RefreshResult | null> | null = null;

function refreshAccessToken(): Promise<RefreshResult | null> {
  refreshPromise ??= performRefresh().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

async function refreshAccessTokenOnly(): Promise<string | null> {
  const result = await refreshAccessToken();
  return result?.accessToken ?? null;
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retry && !original.url?.includes("/auth/")) {
      original._retry = true;
      const token = await refreshAccessTokenOnly();
      if (token) {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      }
    }
    return Promise.reject(error);
  }
);

export { refreshAccessToken };
export type { RefreshResult };
