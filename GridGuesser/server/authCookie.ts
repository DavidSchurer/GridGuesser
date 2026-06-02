import type { CookieOptions } from "express";

/** How long users stay signed in (cookie + JWT should match). */
export const AUTH_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function isCrossOriginDeployment(): boolean {
  try {
    const app = process.env.NEXT_PUBLIC_APP_URL;
    const api = process.env.NEXT_PUBLIC_SOCKET_URL;
    if (!app || !api) return false;
    return new URL(app).host !== new URL(api).host;
  } catch {
    return false;
  }
}

/** Options for setting `auth_token` (login/signup). */
export function getAuthCookieOptions(): CookieOptions {
  const isProd = process.env.NODE_ENV === "production";
  const crossOrigin = isCrossOriginDeployment();
  const domain = process.env.COOKIE_DOMAIN?.trim();

  const opts: CookieOptions = {
    httpOnly: true,
    secure: isProd || crossOrigin,
    // Cross-origin frontend→API (different hosts) needs None+Secure for the cookie to stick
    sameSite: crossOrigin && isProd ? "none" : "lax",
    maxAge: AUTH_SESSION_MAX_AGE_MS,
    path: "/",
  };

  if (domain) {
    opts.domain = domain;
  }

  return opts;
}

/** Options for clearing `auth_token` (must match set options). */
export function getClearAuthCookieOptions(): CookieOptions {
  const { maxAge: _maxAge, ...rest } = getAuthCookieOptions();
  return rest;
}
