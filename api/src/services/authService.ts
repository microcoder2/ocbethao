import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import {
  AuthProvider,
  CustomerType,
  Role,
  type User,
} from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../utils/prisma";

export type LoginSuccessResponse = {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: number;
    fullName: string;
    role: string;
    username: string | null;
    phone: string | null;
    email: string | null;
    customerType: string | null;
  };
};

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

type TokenPayload = {
  sub: number;
  role: string;
  fullName: string;
  sid?: number;
};

const ACCESS_TOKEN_TTL = (process.env.ACCESS_TOKEN_TTL || "2h") as SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL = (process.env.REFRESH_TOKEN_TTL || "7d") as SignOptions["expiresIn"];

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function getRequestContext(req?: Request): { ip?: string; userAgent?: string } {
  if (!req) return {};
  const forwarded = req.headers["x-forwarded-for"];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : typeof forwarded === "string"
      ? forwarded.split(",")[0]?.trim()
      : req.ip;
  const userAgent = req.headers["user-agent"];
  return {
    ip,
    userAgent: typeof userAgent === "string" ? userAgent : undefined,
  };
}

async function logAuthEvent(
  action: string,
  userId?: number | null,
  req?: Request,
  meta?: Prisma.InputJsonValue
): Promise<void> {
  const { ip, userAgent } = getRequestContext(req);
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        action,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        meta: meta ?? undefined,
      },
    });
  } catch {
    // Ignore audit errors to keep auth flow fast.
  }
}

function buildUserPayload(user: User) {
  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    username: user.username ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    customerType: user.customerType ?? null,
  };
}

function ensureJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthError(500, "JWT secret not configured");
  }
  return secret;
}

async function issueTokens(
  user: User,
  req?: Request
): Promise<{ accessToken: string; refreshToken: string; sessionId: number }> {
  const secret = ensureJwtSecret();
  const basePayload: TokenPayload = {
    sub: user.id,
    role: user.role,
    fullName: user.fullName,
  };

  const refreshToken = jwt.sign(basePayload, secret, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  const refreshTokenHash = hashToken(refreshToken);
  const { ip, userAgent } = getRequestContext(req);
  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      refreshTokenHash,
      ip: ip ?? null,
      userAgent: userAgent ?? null,
      lastSeenAt: new Date(),
    },
  });

  const accessToken = jwt.sign({ ...basePayload, sid: session.id }, secret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

  return { accessToken, refreshToken, sessionId: session.id };
}

async function rotateRefreshToken(
  sessionId: number,
  user: User,
  req?: Request
): Promise<{ accessToken: string; refreshToken: string }> {
  const secret = ensureJwtSecret();
  const basePayload: TokenPayload = {
    sub: user.id,
    role: user.role,
    fullName: user.fullName,
  };
  const refreshToken = jwt.sign(basePayload, secret, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  const refreshTokenHash = hashToken(refreshToken);
  const { ip, userAgent } = getRequestContext(req);

  await prisma.userSession.update({
    where: { id: sessionId },
    data: {
      refreshTokenHash,
      lastSeenAt: new Date(),
      ip: ip ?? undefined,
      userAgent: userAgent ?? undefined,
    },
  });

  const accessToken = jwt.sign({ ...basePayload, sid: sessionId }, secret, {
    expiresIn: ACCESS_TOKEN_TTL,
  });

  return { accessToken, refreshToken };
}

export async function authenticateUser(
  identifier: string,
  password: string,
  req?: Request
): Promise<LoginSuccessResponse> {
  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier || !password) {
    throw new AuthError(400, "identifier and password are required");
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: normalizedIdentifier },
        { phone: normalizedIdentifier },
        { email: normalizedIdentifier },
      ],
      isActive: true,
    },
  });

  if (!user) {
    await logAuthEvent("LOGIN_FAILURE", undefined, req, {
      identifier: normalizedIdentifier,
    });
    throw new AuthError(401, "Invalid credentials");
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    await logAuthEvent("LOGIN_FAILURE", user.id, req, {
      identifier: normalizedIdentifier,
    });
    throw new AuthError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken, sessionId } = await issueTokens(user, req);
  await logAuthEvent("LOGIN_SUCCESS", user.id, req, {
    sessionId,
    identifier: normalizedIdentifier,
  });

  return {
    accessToken,
    refreshToken,
    user: buildUserPayload(user),
  };
}

export async function registerCustomer(
  input: {
    fullName: string;
    password: string;
    provider: AuthProvider;
    identifier: string;
    customerType?: CustomerType;
  },
  req?: Request
): Promise<LoginSuccessResponse> {
  const { fullName, password, provider, identifier, customerType } = input;
  if (!fullName || !password || !identifier) {
    throw new AuthError(400, "fullName, identifier and password are required");
  }

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { phone: identifier },
        { email: identifier },
        { zaloId: identifier },
        { appleId: identifier },
      ],
    },
  });
  if (existing) {
    throw new AuthError(409, "Account already exists", "ACCOUNT_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const data: Prisma.UserCreateInput = {
    fullName,
    password: passwordHash,
    role: Role.CUSTOMER,
    preferredAuthProvider: provider,
    customerType: customerType ?? CustomerType.REGULAR,
    username:
      provider === AuthProvider.PHONE
        ? `u${identifier.replace(/\D/g, "")}`
        : undefined,
  };

  if (provider === AuthProvider.PHONE) data.phone = identifier;
  if (provider === AuthProvider.EMAIL) data.email = identifier;
  if (provider === AuthProvider.ZALO) data.zaloId = identifier;
  if (provider === AuthProvider.APPLE) data.appleId = identifier;

  const user = await prisma.user.create({ data });
  const { accessToken, refreshToken, sessionId } = await issueTokens(user, req);
  await logAuthEvent("REGISTER_CUSTOMER", user.id, req, { provider, sessionId });

  return {
    accessToken,
    refreshToken,
    user: buildUserPayload(user),
  };
}

export async function refreshTokens(
  refreshToken: string,
  req?: Request
): Promise<LoginSuccessResponse> {
  if (!refreshToken) {
    throw new AuthError(401, "Missing refresh token");
  }

  const secret = ensureJwtSecret();
  try {
    const payload = jwt.verify(refreshToken, secret) as unknown as TokenPayload;
    const userId = Number(payload.sub);
    const refreshTokenHash = hashToken(refreshToken);
    const session = await prisma.userSession.findFirst({
      where: {
        userId,
        refreshTokenHash,
        revokedAt: null,
        logoutAt: null,
      },
    });
    if (!session) {
      throw new AuthError(401, "Invalid refresh token");
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new AuthError(401, "Invalid refresh token");
    }

    const rotated = await rotateRefreshToken(session.id, user, req);
    await logAuthEvent("REFRESH_SUCCESS", user.id, req, { sessionId: session.id });

    return {
      ...rotated,
      user: buildUserPayload(user),
    };
  } catch (error) {
    await logAuthEvent("REFRESH_FAILURE", undefined, req);
    if (error instanceof AuthError) {
      throw error;
    }
    throw new AuthError(401, "Invalid refresh token");
  }
}

export async function logoutSession(
  refreshToken: string,
  req?: Request
): Promise<void> {
  if (!refreshToken) return;
  const refreshTokenHash = hashToken(refreshToken);
  const session = await prisma.userSession.findFirst({
    where: { refreshTokenHash, revokedAt: null, logoutAt: null },
  });

  if (!session) return;

  await prisma.userSession.update({
    where: { id: session.id },
    data: {
      logoutAt: new Date(),
      revokedAt: new Date(),
    },
  });
  await logAuthEvent("LOGOUT", session.userId, req, { sessionId: session.id });
}
