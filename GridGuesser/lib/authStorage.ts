/** Client-only persisted session token (complements httpOnly cookie for cross-origin prod). */
const STORAGE_KEY = "gridguesser_auth_token";

export function getStoredAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredAuthToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, token);
  } catch {
    // Private browsing / quota — cookie-only session may still work
  }
}

export function clearStoredAuthToken(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** Headers to send on authenticated API requests (Bearer fallback). */
export function getAuthHeaders(): Record<string, string> {
  const token = getStoredAuthToken();
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}
