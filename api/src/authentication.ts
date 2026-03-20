import type { Request } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "./utils/prisma";
import type { AuthUser } from "./types";

type TokenPayload = {
  sub?: number | string;
  role?: string;
  fullName?: string;
  sid?: number;
};

type HttpError = Error & { status?: number };

const SESSION_TOUCH_MS = Number(process.env.SESSION_TOUCH_MS || 60_000);
const lastSeenCache = new Map<number, number>();

async function touchSession(sessionId: number): Promise<void> {
  const now = Date.now();
  const lastSeenAt = lastSeenCache.get(sessionId) || 0;
  if (now - lastSeenAt < SESSION_TOUCH_MS) return;
  lastSeenCache.set(sessionId, now);

  try {
    await prisma.userSession.updateMany({
      where: {
        id: sessionId,
        revokedAt: null,
        logoutAt: null,
      },
      data: { lastSeenAt: new Date(now) },
    });
  } catch {
    // Ignore session touch failures.
  }
}

export async function expressAuthentication(
  request: Request,
  securityName: string,
  scopes?: string[]
): Promise<AuthUser> {
  if (securityName !== "bearerAuth") {
    const error = new Error("Unsupported security scheme") as HttpError;
    error.status = 401;
    throw error;
  }

  const header = request.headers.authorization;
  if (!header) {
    const error = new Error("Missing Authorization header") as HttpError;
    error.status = 401;
    throw error;
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    const error = new Error("Invalid Authorization format") as HttpError;
    error.status = 401;
    throw error;
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const error = new Error("JWT secret not configured") as HttpError;
    error.status = 500;
    throw error;
  }

  try {
    const decoded = jwt.verify(token, secret) as TokenPayload;
    const id = Number(decoded.sub);
    const role = String(decoded.role || "").toUpperCase();
    const fullName = String(decoded.fullName || "");
    const sessionId = Number(decoded.sid);

    if (!Number.isFinite(id) || !role) {
      const error = new Error("Invalid access token") as HttpError;
      error.status = 401;
      throw error;
    }

    if (Array.isArray(scopes) && scopes.length > 0 && !scopes.includes(role)) {
      const error = new Error("Forbidden") as HttpError;
      error.status = 403;
      throw error;
    }

    if (Number.isFinite(sessionId)) {
      void touchSession(sessionId);
    }

    return { id, role, fullName };
  } catch (error) {
    const httpError = (error instanceof Error ? error : new Error("Unauthorized")) as HttpError;
    httpError.status = httpError.status || 401;
    throw httpError;
  }
}
