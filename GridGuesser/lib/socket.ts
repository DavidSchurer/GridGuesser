"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Get auth token from localStorage
    const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;
    
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      autoConnect: false,
      auth: {
        token: token || undefined,
      },
    });
  }
  return socket;
};

export const connectSocket = (): Socket => {
  const socket = getSocket();
  if (!socket.connected) {
    socket.connect();
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

// Reconnect with new auth token (for when user logs in/out)
export const reconnectSocket = () => {
  disconnectSocket();
  return connectSocket();
};

