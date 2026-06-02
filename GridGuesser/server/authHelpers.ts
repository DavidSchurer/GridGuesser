import { Request } from "express";
import { verifyToken, JWTPayload } from "../lib/jwt";

/** Read JWT from httpOnly cookie or `Authorization: Bearer` header. */
export function getAuthTokenFromRequest(req: Request): string | null {
  const fromCookie = req.cookies?.auth_token;
  if (fromCookie) return fromCookie;

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim() || null;
  }

  return null;
}

export function getAuthPayloadFromRequest(req: Request): JWTPayload | null {
  const token = getAuthTokenFromRequest(req);
  if (!token) return null;
  return verifyToken(token);
}
