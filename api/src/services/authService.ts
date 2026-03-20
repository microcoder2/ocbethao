import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Prisma } from "@prisma/client";
import { CustomerType, Role, type User } from "@prisma/client";
import type { Request } from "express";
import {
  deleteLocalAuthIdentitiesForUser,
  deleteAuthIdentityForUser,
  findUserByVerifiedContact,
  type AuthIdentityInput,
  IdentityError,
  normalizeProviderUserId,
  replaceExternalAuthIdentities,
  upsertAuthIdentityForUser,
} from "./accountIdentityService";
import {
  getAuthProvider,
  getAuthProviders,
  type AuthProviderDefinition,
  normalizeProvider,
} from "./authProviders";
import {
  GoogleIdentityError,
  verifyGoogleIdToken,
} from "./googleIdentityService";
import {
  FacebookIdentityError,
  verifyFacebookAccessToken,
} from "./facebookIdentityService";
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
    preferredAuthProvider: string | null;
    linkedAuthProviders: string[];
  };
};

export type ExternalAuthStartResponse = {
  provider: string;
  intent: string;
  state: string;
  nonce: string;
  expiresAt: Date;
  callbackUrl: string;
  authUrl: string;
  isReady: boolean;
  message: string;
};

export type AuthProviderCatalogResponse = {
  providers: AuthProviderDefinition[];
};

type TokenPayload = {
  sub: number;
  role: string;
  fullName: string;
  sid?: number;
};

type UserWithAuthContext = Prisma.UserGetPayload<{
  include: {
    authIdentities: true;
  };
}>;

const ACCESS_TOKEN_TTL = (process.env.ACCESS_TOKEN_TTL || "2h") as SignOptions["expiresIn"];
const REFRESH_TOKEN_TTL = (process.env.REFRESH_TOKEN_TTL || "7d") as SignOptions["expiresIn"];

export class AuthError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function randomToken(size = 24): string {
  return crypto.randomBytes(size).toString("hex");
}

function cleanNullable(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim();
  return normalized ? normalized : null;
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPhoneLike(value: string): boolean {
  return /^[+\d][\d\s().-]{7,}$/.test(value);
}

function inferIdentifierFields(identifier: string): {
  username?: string;
  phone?: string;
  email?: string;
} {
  const value = String(identifier || "").trim();
  if (!value) {
    return {};
  }
  if (isEmailLike(value)) {
    return { email: value.toLowerCase() };
  }
  if (isPhoneLike(value)) {
    return { phone: value.replace(/\s+/g, "") };
  }
  return { username: value };
}

function buildGeneratedUsername(identifier: string): string | null {
  const digits = identifier.replace(/\D/g, "");
  if (digits) {
    return `u${digits}`;
  }
  const slug = identifier
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug ? `u-${slug}` : null;
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

function getRequestOrigin(req?: Request): string {
  if (!req) {
    return "http://localhost:3000";
  }
  const protocol = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
  const host = (req.headers["x-forwarded-host"] as string) || req.get("host") || "localhost:3000";
  return `${protocol}://${host}`;
}

function getActiveAuthIdentities(user: { authIdentities?: Array<{ provider: string; revokedAt: Date | null }> }) {
  return Array.isArray(user.authIdentities)
    ? user.authIdentities.filter((identity) => !identity.revokedAt)
    : [];
}

async function loadUserWithAuth(userId: number): Promise<UserWithAuthContext> {
  return prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      authIdentities: true,
    },
  });
}

function buildUserPayload(user: UserWithAuthContext | User) {
  const identities = "authIdentities" in user ? getActiveAuthIdentities(user) : [];
  const linkedAuthProviders = Array.from(
    new Set(identities.map((identity) => identity.provider))
  );

  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role,
    username: user.username ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    customerType: user.customerType ?? null,
    preferredAuthProvider: user.preferredAuthProvider ?? null,
    linkedAuthProviders,
  };
}

function ensureJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new AuthError(500, "JWT secret not configured");
  }
  return secret;
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

async function issueTokens(
  user: User,
  req?: Request,
  options?: { loginProvider?: string; authIdentityId?: number | null }
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
      authIdentityId: options?.authIdentityId ?? null,
      loginProvider: options?.loginProvider ?? "password",
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

async function markIdentityLogin(identityId: number): Promise<void> {
  await prisma.userAuthIdentity.update({
    where: { id: identityId },
    data: {
      lastLoginAt: new Date(),
      revokedAt: null,
    },
  });
}

async function markChallengeConsumed(id: number | null | undefined): Promise<void> {
  if (!id) return;
  await prisma.authChallenge.update({
    where: { id },
    data: {
      consumedAt: new Date(),
    },
  });
}

async function validateChallenge(provider: string, state?: string | null) {
  const normalizedState = cleanNullable(state);
  if (!normalizedState) {
    return null;
  }

  const challenge = await prisma.authChallenge.findUnique({
    where: { state: normalizedState },
  });

  if (!challenge || challenge.provider !== provider) {
    throw new AuthError(400, "Invalid auth challenge", "INVALID_CHALLENGE");
  }

  if (challenge.consumedAt) {
    throw new AuthError(400, "Auth challenge already consumed", "CHALLENGE_CONSUMED");
  }

  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new AuthError(400, "Auth challenge expired", "CHALLENGE_EXPIRED");
  }

  return challenge;
}

function ensureProvider(
  provider: string,
  options?: {
    allowPassword?: boolean;
    requireLoginEnabled?: boolean;
    requireLinkEnabled?: boolean;
    requireReady?: boolean;
  }
) {
  const normalized = normalizeProvider(provider);
  const definition = getAuthProvider(normalized);

  if (!definition) {
    throw new AuthError(400, "Unsupported auth provider", "UNSUPPORTED_PROVIDER");
  }

  if (!options?.allowPassword && definition.key === "password") {
    throw new AuthError(400, "Use /auth/login for password login", "PASSWORD_PROVIDER_ONLY");
  }

  if (options?.requireLoginEnabled && !definition.isEnabled) {
    throw new AuthError(403, "Auth provider is disabled", "PROVIDER_DISABLED");
  }

  if (options?.requireLinkEnabled && !definition.isLinkEnabled) {
    throw new AuthError(403, "Auth provider linking is disabled", "PROVIDER_LINK_DISABLED");
  }

  if (options?.requireReady && !definition.isReady) {
    throw new AuthError(503, "Auth provider is not configured", "PROVIDER_NOT_READY");
  }

  return definition;
}

async function resolveVerifiedExternalInput(
  definition: AuthProviderDefinition,
  input: CompleteExternalAuthInput
): Promise<CompleteExternalAuthInput> {
  if (definition.key === "google") {
    try {
      const googleIdentity = await verifyGoogleIdToken(String(input.idToken || ""));
      return {
        ...input,
        providerUserId: googleIdentity.providerUserId,
        email: googleIdentity.email,
        fullName: googleIdentity.fullName,
        avatarUrl: googleIdentity.avatarUrl,
        emailVerified: googleIdentity.emailVerified,
        phoneVerified: false,
        rawProfile: googleIdentity.rawProfile as Prisma.InputJsonValue,
      };
    } catch (error) {
      if (error instanceof GoogleIdentityError) {
        throw new AuthError(error.status, error.message, error.code);
      }
      throw error;
    }
  }

  if (definition.key === "facebook") {
    try {
      const facebookIdentity = await verifyFacebookAccessToken(
        String(input.accessToken || "")
      );
      return {
        ...input,
        providerUserId: facebookIdentity.providerUserId,
        email: facebookIdentity.email,
        fullName: facebookIdentity.fullName,
        avatarUrl: facebookIdentity.avatarUrl,
        emailVerified: facebookIdentity.emailVerified,
        phoneVerified: false,
        rawProfile: facebookIdentity.rawProfile as Prisma.InputJsonValue,
      };
    } catch (error) {
      if (error instanceof FacebookIdentityError) {
        throw new AuthError(error.status, error.message, error.code);
      }
      throw error;
    }
  }

  return input;
}

function buildIdentityCandidate(
  provider: string,
  input: CompleteExternalAuthInput
): AuthIdentityInput {
  const providerUserId = normalizeProviderUserId(
    provider,
    String(input.providerUserId || input.email || input.phone || input.username || "").trim()
  );

  if (!providerUserId) {
    throw new AuthError(400, "providerUserId is required", "MISSING_PROVIDER_USER_ID");
  }

  return {
    provider,
    providerUserId,
    providerEmail: cleanNullable(input.email)?.toLowerCase() || null,
    providerPhone: cleanNullable(input.phone),
    providerUsername: cleanNullable(input.username),
    displayName: cleanNullable(input.fullName),
    avatarUrl: cleanNullable(input.avatarUrl),
    emailVerified: Boolean(input.emailVerified),
    phoneVerified: Boolean(input.phoneVerified),
    rawProfile: input.rawProfile,
  };
}

async function createCustomerFromExternalIdentity(
  provider: string,
  identity: AuthIdentityInput
): Promise<UserWithAuthContext> {
  const user = await prisma.user.create({
    data: {
      fullName: cleanNullable(identity.displayName) || "Khach moi",
      role: Role.CUSTOMER,
      phone: identity.providerPhone || undefined,
      email: identity.providerEmail || undefined,
      customerType: CustomerType.REGULAR,
      preferredAuthProvider: provider,
      avatarUrl: identity.avatarUrl || undefined,
      password: null,
    },
    include: {
      authIdentities: true,
    },
  });

  const loaded = await loadUserWithAuth(user.id);
  return loaded;
}

async function resolveExternalUser(
  provider: string,
  identityInput: AuthIdentityInput
): Promise<{ user: UserWithAuthContext; authIdentityId: number }> {
  const existingIdentity = await prisma.userAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider,
        providerUserId: normalizeProviderUserId(provider, identityInput.providerUserId),
      },
    },
    include: {
      user: {
        include: {
          authIdentities: true,
        },
      },
    },
  });

  if (existingIdentity) {
    if (!existingIdentity.user.isActive) {
      throw new AuthError(403, "Account is disabled");
    }
    await markIdentityLogin(existingIdentity.id);
    return {
      user: existingIdentity.user,
      authIdentityId: existingIdentity.id,
    };
  }

  let targetUser: UserWithAuthContext | null = null;
  if (identityInput.emailVerified || identityInput.phoneVerified) {
    targetUser = await findUserByVerifiedContact({
      email: identityInput.emailVerified ? identityInput.providerEmail : null,
      phone: identityInput.phoneVerified ? identityInput.providerPhone : null,
    });
  }

  if (!targetUser) {
    targetUser = await createCustomerFromExternalIdentity(provider, identityInput);
  }

  const authIdentity = await upsertAuthIdentityForUser(targetUser.id, identityInput);
  await markIdentityLogin(authIdentity.id);

  if (
    !targetUser.preferredAuthProvider ||
    targetUser.preferredAuthProvider === "password"
  ) {
    await prisma.user.update({
      where: { id: targetUser.id },
      data: {
        preferredAuthProvider: provider,
        avatarUrl: targetUser.avatarUrl || identityInput.avatarUrl || undefined,
      },
    });
    targetUser = await loadUserWithAuth(targetUser.id);
  }

  return {
    user: targetUser,
    authIdentityId: authIdentity.id,
  };
}

function toLoginSuccessResponse(
  user: UserWithAuthContext,
  tokens: { accessToken: string; refreshToken?: string }
): LoginSuccessResponse {
  return {
    ...tokens,
    user: buildUserPayload(user),
  };
}

export function getAuthProviderCatalog(): AuthProviderCatalogResponse {
  return {
    providers: getAuthProviders(),
  };
}

export async function authenticateUser(
  identifier: string,
  password: string,
  req?: Request
): Promise<LoginSuccessResponse> {
  const normalizedIdentifier = String(identifier || "").trim();
  if (!normalizedIdentifier || !password) {
    throw new AuthError(400, "identifier and password are required");
  }

  const emailCandidate = normalizedIdentifier.toLowerCase();
  const user = await prisma.user.findFirst({
    where: {
      isActive: true,
      OR: [
        { username: normalizedIdentifier },
        { phone: normalizedIdentifier.replace(/\s+/g, "") },
        { email: emailCandidate },
      ],
    },
    include: {
      authIdentities: true,
    },
  });

  if (!user) {
    await logAuthEvent("LOGIN_FAILURE", undefined, req, {
      identifier: normalizedIdentifier,
      provider: "password",
    });
    throw new AuthError(401, "Invalid credentials");
  }

  if (!user.password) {
    await logAuthEvent("LOGIN_FAILURE", user.id, req, {
      identifier: normalizedIdentifier,
      provider: "password",
      reason: "PASSWORD_NOT_SET",
    });
    throw new AuthError(401, "Password login is not available for this account");
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    await logAuthEvent("LOGIN_FAILURE", user.id, req, {
      identifier: normalizedIdentifier,
      provider: "password",
    });
    throw new AuthError(401, "Invalid credentials");
  }

  const { accessToken, refreshToken, sessionId } = await issueTokens(user, req, {
    loginProvider: "password",
  });
  await logAuthEvent("LOGIN_SUCCESS", user.id, req, {
    sessionId,
    identifier: normalizedIdentifier,
    provider: "password",
  });

  return toLoginSuccessResponse(user, { accessToken, refreshToken });
}

export async function registerCustomer(
  input: {
    fullName: string;
    password: string;
    provider: string;
    identifier: string;
    customerType?: CustomerType;
  },
  req?: Request
): Promise<LoginSuccessResponse> {
  const fullName = cleanNullable(input.fullName);
  const password = String(input.password || "");
  const provider = normalizeProvider(input.provider || "phone");
  const identifier = String(input.identifier || "").trim();

  if (!fullName || !password || !identifier) {
    throw new AuthError(400, "fullName, identifier and password are required");
  }

  const localFields =
    provider === "password" ? inferIdentifierFields(identifier) : inferIdentifierFields(identifier);
  const generatedUsername =
    localFields.username ||
    (provider === "phone" || provider === "email"
      ? buildGeneratedUsername(identifier) || undefined
      : undefined);

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        ...(localFields.username ? [{ username: localFields.username }] : []),
        ...(localFields.phone ? [{ phone: localFields.phone }] : []),
        ...(localFields.email ? [{ email: localFields.email }] : []),
      ],
    },
  });

  if (existingUser) {
    throw new AuthError(409, "Account already exists", "ACCOUNT_EXISTS");
  }

  const existingIdentity = await prisma.userAuthIdentity.findUnique({
    where: {
      provider_providerUserId: {
        provider,
        providerUserId: normalizeProviderUserId(provider, identifier),
      },
    },
  });

  if (existingIdentity) {
    throw new AuthError(409, "Account already exists", "ACCOUNT_EXISTS");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      fullName,
      password: passwordHash,
      role: Role.CUSTOMER,
      username: generatedUsername,
      phone: localFields.phone,
      email: localFields.email,
      preferredAuthProvider: provider,
      customerType: input.customerType ?? CustomerType.REGULAR,
    },
    include: {
      authIdentities: true,
    },
  });

  if (!["password", "username", "phone", "email"].includes(provider)) {
    await upsertAuthIdentityForUser(user.id, {
      provider,
      providerUserId: identifier,
      providerEmail: localFields.email || null,
      providerPhone: localFields.phone || null,
      providerUsername: localFields.username || null,
      displayName: fullName,
    });
  }

  const loaded = await loadUserWithAuth(user.id);
  const { accessToken, refreshToken, sessionId } = await issueTokens(loaded, req, {
    loginProvider: "password",
  });
  await logAuthEvent("REGISTER_CUSTOMER", loaded.id, req, {
    provider,
    sessionId,
  });

  return toLoginSuccessResponse(loaded, { accessToken, refreshToken });
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

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        authIdentities: true,
      },
    });
    if (!user || !user.isActive) {
      throw new AuthError(401, "Invalid refresh token");
    }

    const rotated = await rotateRefreshToken(session.id, user, req);
    await logAuthEvent("REFRESH_SUCCESS", user.id, req, {
      sessionId: session.id,
      provider: session.loginProvider ?? "password",
    });

    return toLoginSuccessResponse(user, rotated);
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
  await logAuthEvent("LOGOUT", session.userId, req, {
    sessionId: session.id,
    provider: session.loginProvider ?? "password",
  });
}

export async function startExternalAuth(
  provider: string,
  input: {
    redirectUri?: string;
    intent?: string;
  },
  req?: Request,
  userId?: number
): Promise<ExternalAuthStartResponse> {
  const intent = normalizeProvider(input.intent || "login") || "login";
  const definition = ensureProvider(provider, {
    requireLoginEnabled: intent === "login",
    requireLinkEnabled: intent === "link",
  });

  if (intent === "link" && !userId) {
    throw new AuthError(401, "Authentication required to link provider");
  }

  const state = randomToken(16);
  const nonce = randomToken(16);
  const codeVerifier = randomToken(32);
  const callbackUrl = `${getRequestOrigin(req)}/api/auth/external/${definition.key}/callback`;
  const authUrl = definition.isReady
    ? `${callbackUrl}?state=${encodeURIComponent(state)}`
    : `${callbackUrl}?state=${encodeURIComponent(state)}&mode=placeholder`;

  const challenge = await prisma.authChallenge.create({
    data: {
      userId: userId ?? null,
      provider: definition.key,
      intent,
      state,
      nonce,
      codeVerifier,
      redirectUri: cleanNullable(input.redirectUri),
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  await logAuthEvent("AUTH_CHALLENGE_CREATED", userId ?? null, req, {
    provider: definition.key,
    intent,
    challengeId: challenge.id,
  });

  return {
    provider: definition.key,
    intent,
    state,
    nonce,
    expiresAt: challenge.expiresAt,
    callbackUrl,
    authUrl,
    isReady: definition.isReady,
    message: definition.isReady
      ? "Redirect user to authUrl, then exchange provider callback at /auth/external/{provider}/complete."
      : "Provider adapter is not wired yet. The challenge is created so frontend and backend contracts can be integrated first.",
  };
}

export type CompleteExternalAuthInput = {
  state?: string;
  providerUserId?: string;
  email?: string;
  phone?: string;
  username?: string;
  fullName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  code?: string;
  idToken?: string;
  accessToken?: string;
  rawProfile?: Prisma.InputJsonValue;
};

export async function completeExternalAuth(
  provider: string,
  input: CompleteExternalAuthInput,
  req?: Request
): Promise<LoginSuccessResponse> {
  const definition = ensureProvider(provider, {
    requireLoginEnabled: true,
    requireReady: true,
  });
  const verifiedInput = await resolveVerifiedExternalInput(definition, input);
  const challenge = await validateChallenge(definition.key, verifiedInput.state);
  const identityInput = buildIdentityCandidate(definition.key, verifiedInput);
  const resolved = await resolveExternalUser(definition.key, identityInput);
  const user = await loadUserWithAuth(resolved.user.id);
  const { accessToken, refreshToken, sessionId } = await issueTokens(user, req, {
    loginProvider: definition.key,
    authIdentityId: resolved.authIdentityId,
  });

  await markChallengeConsumed(challenge?.id);
  await logAuthEvent("EXTERNAL_LOGIN_SUCCESS", user.id, req, {
    provider: definition.key,
    authIdentityId: resolved.authIdentityId,
    sessionId,
    hasCode: Boolean(cleanNullable(verifiedInput.code)),
    hasIdToken: Boolean(cleanNullable(verifiedInput.idToken)),
    hasAccessToken: Boolean(cleanNullable(verifiedInput.accessToken)),
  });

  return toLoginSuccessResponse(user, { accessToken, refreshToken });
}

export async function getExternalAuthCallbackResult(
  provider: string,
  input: {
    state?: string;
    code?: string;
    error?: string;
  }
) {
  const definition = ensureProvider(provider);
  const challenge = await validateChallenge(definition.key, input.state);

  return {
    provider: definition.key,
    state: challenge?.state || null,
    intent: challenge?.intent || "login",
    hasCode: Boolean(cleanNullable(input.code)),
    error: cleanNullable(input.error),
    message: cleanNullable(input.error)
      ? "Provider callback returned an error. Handle it on frontend or exchange it at /auth/external/{provider}/complete."
      : "Provider callback received. Exchange provider data at /auth/external/{provider}/complete.",
  };
}

export async function linkExternalAuthIdentity(
  userId: number,
  provider: string,
  input: CompleteExternalAuthInput,
  req?: Request
) {
  const definition = ensureProvider(provider, {
    requireLinkEnabled: true,
    requireReady: true,
  });
  const verifiedInput = await resolveVerifiedExternalInput(definition, input);
  const challenge = await validateChallenge(definition.key, verifiedInput.state);

  if (challenge?.intent === "link" && challenge.userId && challenge.userId !== userId) {
    throw new AuthError(403, "Auth challenge belongs to another user");
  }

  const identityInput = buildIdentityCandidate(definition.key, verifiedInput);
  let authIdentityId: number;

  try {
    const identity = await upsertAuthIdentityForUser(userId, identityInput);
    authIdentityId = identity.id;
    await markIdentityLogin(identity.id);
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new AuthError(error.status, error.message, error.code);
    }
    throw error;
  }

  await markChallengeConsumed(challenge?.id);

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      preferredAuthProvider: definition.key,
      avatarUrl: cleanNullable(verifiedInput.avatarUrl) || undefined,
    },
    include: {
      authIdentities: true,
    },
  });

  await logAuthEvent("AUTH_IDENTITY_LINKED", userId, req, {
    provider: definition.key,
    authIdentityId,
  });

  return buildUserPayload(user);
}

export async function unlinkExternalAuthIdentity(
  userId: number,
  provider: string,
  identityId: number,
  req?: Request
) {
  try {
    await deleteAuthIdentityForUser(userId, provider, identityId);
  } catch (error) {
    if (error instanceof IdentityError) {
      throw new AuthError(error.status, error.message, error.code);
    }
    throw error;
  }

  const user = await loadUserWithAuth(userId);
  const remainingProviders = buildUserPayload(user).linkedAuthProviders;
  const normalizedProvider = normalizeProvider(provider);

  if (user.preferredAuthProvider === normalizedProvider) {
    await prisma.user.update({
      where: { id: userId },
      data: {
        preferredAuthProvider: remainingProviders[0] || (user.password ? "password" : null),
      },
    });
  }

  await logAuthEvent("AUTH_IDENTITY_UNLINKED", userId, req, {
    provider: normalizedProvider,
    authIdentityId: identityId,
  });

  const refreshed = await loadUserWithAuth(userId);
  return buildUserPayload(refreshed);
}

export async function syncUserAuthSetup(
  userId: number,
  input: {
    preferredAuthProvider?: string | null;
    authIdentities?: AuthIdentityInput[];
  }
) {
  const user = await loadUserWithAuth(userId);
  await deleteLocalAuthIdentitiesForUser(userId);

  if (Array.isArray(input.authIdentities)) {
    try {
      await replaceExternalAuthIdentities(userId, input.authIdentities);
    } catch (error) {
      if (error instanceof IdentityError) {
        throw new AuthError(error.status, error.message, error.code);
      }
      throw error;
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      preferredAuthProvider: cleanNullable(input.preferredAuthProvider) || user.preferredAuthProvider,
    },
    include: {
      authIdentities: true,
    },
  });

  return updated;
}
