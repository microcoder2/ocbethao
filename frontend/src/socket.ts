import { io } from "socket.io-client";
import { API_BASE_URL } from "./config";

export const socket = io(API_BASE_URL, {
  path: "/socket.io",
  autoConnect: true,
  transports: ["websocket", "polling"],
  reconnectionAttempts: 10,
  reconnectionDelay: 2000,
});
