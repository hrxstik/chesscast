import { getApiUrl } from "@/lib/utils";
import { ApiError } from "./types";
import toast from "react-hot-toast";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  skipAuth?: boolean;
  /** Не показывать toast при ошибке (например, свой UI). */
  silent?: boolean;
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch(`${getApiUrl()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    })
      .then((res) => res.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, skipAuth, headers: initHeaders, ...rest } = options;
  const url = path.startsWith("http") ? path : `${getApiUrl()}${path}`;

  const headers = new Headers(initHeaders);
  if (body !== undefined && !(body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const doFetch = async () => {
    try {
      return await fetch(url, {
        ...rest,
        credentials: "include",
        headers,
        body:
          body === undefined
            ? undefined
            : body instanceof FormData
              ? body
              : JSON.stringify(body),
      });
    } catch (e) {
      const api = getApiUrl();
      const hint = `Не удалось связаться с API`;
      throw new ApiError(
        e instanceof Error ? `${hint} ${e.message}`.trim() : hint,
        0,
      );
    }
  };

  let res = await doFetch();

  if (res.status === 401 && !skipAuth) {
    const ok = await tryRefreshSession();
    if (ok) {
      res = await doFetch();
    }
  }

  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    let msg = res.statusText;
    if (typeof data === "object" && data !== null && "message" in data) {
      const raw = (data as { message: unknown }).message;
      if (typeof raw === "string") msg = raw;
      else if (Array.isArray(raw)) msg = raw.map(String).join(", ");
    }
    const err = new ApiError(msg || "Request failed", res.status, data);
    const quietAuth =
      msg === "Refresh token missing" || msg === "Authorization token missing";
    if (!options.silent && !quietAuth && typeof window !== "undefined") {
      toast.error(err.message);
    }
    throw err;
  }

  return data as T;
}
