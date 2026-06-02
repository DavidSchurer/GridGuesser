"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { AuthResponse, UserStats } from "./types";
import { getClientApiBase } from "./clientApi";
import {
  getStoredAuthToken,
  setStoredAuthToken,
  clearStoredAuthToken,
  getAuthHeaders,
} from "./authStorage";

interface AuthUser {
  userId: string;
  username: string;
  email: string;
  stats: UserStats;
}

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  signup: (username: string, email: string, password: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = getClientApiBase();

async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const authHeaders = getAuthHeaders() as Record<string, string>;
  if (authHeaders.Authorization) {
    headers.set("Authorization", authHeaders.Authorization);
  }
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshProfile = useCallback(async () => {
    try {
      const response = await authFetch("/auth/profile", { method: "GET" });
      const data = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
      } else if (response.status === 401) {
        setUser(null);
        setToken(null);
        clearStoredAuthToken();
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
    }
  }, []);

  const verifySession = useCallback(async (): Promise<boolean> => {
    try {
      const response = await authFetch("/auth/verify", { method: "GET" });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.success && data.user) {
        await refreshProfile();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Session verification error:", error);
      return false;
    }
  }, [refreshProfile]);

  // Restore session from cookie and/or persisted token on mount
  useEffect(() => {
    const stored = getStoredAuthToken();
    if (stored) {
      setToken(stored);
    }

    verifySession()
      .then((valid) => {
        if (!valid) {
          setUser(null);
          setToken(null);
          clearStoredAuthToken();
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, [verifySession]);

  const login = async (email: string, password: string) => {
    try {
      const response = await authFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        if (data.token) {
          setStoredAuthToken(data.token);
          setToken(data.token);
        }
        setUser(data.user);
        return { success: true };
      }

      return { success: false, message: data.message || "Login failed" };
    } catch (error) {
      console.error("Login error:", error);
      return { success: false, message: "Network error" };
    }
  };

  const signup = async (username: string, email: string, password: string) => {
    try {
      const response = await authFetch("/auth/signup", {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        if (data.token) {
          setStoredAuthToken(data.token);
          setToken(data.token);
        }
        setUser(data.user);
        return { success: true };
      }

      return { success: false, message: data.message || "Signup failed" };
    } catch (error) {
      console.error("Signup error:", error);
      return { success: false, message: "Network error" };
    }
  };

  const logout = async () => {
    try {
      await authFetch("/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setUser(null);
      setToken(null);
      clearStoredAuthToken();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
