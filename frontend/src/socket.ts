import { io } from "socket.io-client";
import { API_BASE_URL } from "./config";
import { getToken } from "./utils/auth";

export const socket = io(API_BASE_URL, {
  path: "/socket.io",
  autoConnect: Boolean(getToken()),
  auth: {
    token: getToken() || undefined,
  },
  transports: ["websocket", "polling"],
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});

function syncSocketAuth() {
  const token = getToken().trim();
  socket.auth = {
    token: token || undefined,
  };

  if (token) {
    if (!socket.connected) {
      socket.connect();
    }
    return;
  }

  socket.disconnect();
}

if (typeof window !== "undefined") {
  window.addEventListener("auth:changed", syncSocketAuth);
}
