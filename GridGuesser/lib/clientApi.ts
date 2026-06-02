/**
 * Base URL for browser API calls. Uses NEXT_PUBLIC_API_URL when set (direct to
 * backend); otherwise falls back to the socket host + /api.
 */
export function getClientApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, "");
  }
  const socket = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (socket) {
    return `${socket.replace(/\/+$/, "")}/api`;
  }
  return "http://localhost:3001/api";
}
