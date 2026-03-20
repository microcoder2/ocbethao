import axios from "axios";
import { API_BASE_URL } from "./config";
import { getToken, logout, saveAuth } from "./utils/auth";

const baseURL = `${API_BASE_URL}/api`;

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }
  return config;
});

let refreshPromise: Promise<any> | null = null;

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const url = String(error?.config?.url || "");
    const isAuthRoute = url.includes("/auth/login") || url.includes("/auth/refresh");

    if (status === 401 && !isAuthRoute && !error?.config?.__isRetryRequest) {
      try {
        if (!refreshPromise) {
          refreshPromise = axios
            .post(`${baseURL}/auth/refresh`, {}, { withCredentials: true })
            .then((response) => {
              const data = response.data || {};
              saveAuth({
                accessToken: data.accessToken,
                user: data.user,
              });
              refreshPromise = null;
              return data;
            })
            .catch((refreshError) => {
              refreshPromise = null;
              throw refreshError;
            });
        }
        const data = await refreshPromise;
        error.config.headers = {
          ...(error.config.headers || {}),
          Authorization: `Bearer ${data.accessToken}`,
        };
        error.config.__isRetryRequest = true;
        return api.request(error.config);
      } catch {
        logout();
        window.location.hash = "#/login";
      }
    }

    return Promise.reject(error);
  }
);
