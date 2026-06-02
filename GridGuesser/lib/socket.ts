"use client";

import { io, Socket } from "socket.io-client";
import { getStoredAuthToken } from "./authStorage";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = getStoredAuthToken();
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      autoConnect: false,
      withCredentials: true,
      auth: token ? { token } : {},
    });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const s = getSocket();
  const token = getStoredAuthToken();
  if (token) {
    s.auth = { token };
  }
  if (!s.connected) {
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/** Reconnect after login/logout so the server gets the latest auth token. */
export const reconnectSocket = () => {
  disconnectSocket();
  return connectSocket();
};
