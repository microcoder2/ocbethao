const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const runtimeApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function resolveApiBaseUrl(): string {
  if (!envApiBaseUrl) {
    return runtimeApiBaseUrl;
  }

  if (typeof window === "undefined") {
    return envApiBaseUrl;
  }

  try {
    const envUrl = new URL(envApiBaseUrl);
    if (isLocalHost(envUrl.hostname) && !isLocalHost(window.location.hostname)) {
      return runtimeApiBaseUrl;
    }
  } catch {
    return envApiBaseUrl;
  }

  return envApiBaseUrl;
}

const apiBaseUrl = resolveApiBaseUrl();

if (!apiBaseUrl) {
  throw new Error("Unable to resolve API base URL");
}

export const API_BASE_URL = apiBaseUrl;
export const APP_NAME = import.meta.env.VITE_APP_NAME || "Oc Be Thao";
