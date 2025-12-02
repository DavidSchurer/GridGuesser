"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { AuthResponse, UserStats } from "./types";

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from server on mount (checks cookie)
  useEffect(() => {
    verifySession()
      .then((valid) => {
        if (!valid) {
          setUser(null);
          setToken(null);
        }
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const verifySession = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/auth/verify`, {
        method: "GET",
        credentials: "include", // Send cookies
      });

      if (!response.ok) {
        return false;
      }

      const data = await response.json();
      if (data.success && data.user) {
        // Session is valid, fetch full profile
        await refreshProfile();
        return true;
      }
      return false;
    } catch (error) {
      console.error("Session verification error:", error);
      return false;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Send/receive cookies
        body: JSON.stringify({ email, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        // Cookie is set by server automatically
        setUser(data.user);
        setToken(null); // Don't store token in frontend
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
      const response = await fetch(`${API_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include", // Send/receive cookies
        body: JSON.stringify({ username, email, password }),
      });

      const data: AuthResponse = await response.json();

      if (data.success && data.user) {
        // Cookie is set by server automatically
        setUser(data.user);
        setToken(null); // Don't store token in frontend
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
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        credentials: "include", // Send cookies
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear state regardless
      setUser(null);
      setToken(null);
    }
  };

  const refreshProfile = async () => {
    try {
      const response = await fetch(`${API_URL}/auth/profile`, {
        method: "GET",
        credentials: "include", // Send cookies
      });

      const data = await response.json();

      if (data.success && data.user) {
        setUser(data.user);
      }
    } catch (error) {
      console.error("Error refreshing profile:", error);
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

