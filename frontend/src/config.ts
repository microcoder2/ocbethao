const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const runtimeApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

function isPrivateNetworkHost(hostname: string): boolean {
  return (
    isLocalHost(hostname) ||
    /^10\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
  );
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
    const currentHostname = window.location.hostname;
    const envIsPrivate = isPrivateNetworkHost(envUrl.hostname);
    const currentIsPrivate = isPrivateNetworkHost(currentHostname);

    if (envIsPrivate && currentIsPrivate && envUrl.hostname !== currentHostname) {
      return runtimeApiBaseUrl;
    }

    if (isLocalHost(envUrl.hostname) && !isLocalHost(currentHostname)) {
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
