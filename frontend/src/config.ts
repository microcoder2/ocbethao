const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL;
const runtimeApiBaseUrl =
  typeof window !== "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : "";

const apiBaseUrl = envApiBaseUrl || runtimeApiBaseUrl;

if (!apiBaseUrl) {
  throw new Error("Unable to resolve API base URL");
}

export const API_BASE_URL = apiBaseUrl;
export const APP_NAME = import.meta.env.VITE_APP_NAME || "Oc Be Thao";
