"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    // Cookies are sent automatically with withCredentials
    socket = io(process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3001", {
      autoConnect: false,
      withCredentials: true, // Send cookies with Socket.IO requests
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

// Reconnect (for when user logs in/out)
export const reconnectSocket = () => {
  disconnectSocket();
  return connectSocket();
};

