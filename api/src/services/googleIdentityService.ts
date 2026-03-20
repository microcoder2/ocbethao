import { OAuth2Client } from "google-auth-library";

export class GoogleIdentityError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export type VerifiedGoogleIdentity = {
  providerUserId: string;
  email?: string;
  emailVerified: boolean;
  fullName?: string;
  avatarUrl?: string;
  hostedDomain?: string;
  rawProfile: Record<string, unknown>;
};

const googleClient = new OAuth2Client();

function getGoogleClientId(): string {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

export function isGoogleConfigured(): boolean {
  return Boolean(getGoogleClientId());
}

export async function verifyGoogleIdToken(idToken: string): Promise<VerifiedGoogleIdentity> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new GoogleIdentityError(503, "Google login is not configured", "GOOGLE_NOT_CONFIGURED");
  }

  const normalizedToken = String(idToken || "").trim();
  if (!normalizedToken) {
    throw new GoogleIdentityError(400, "Missing Google ID token", "GOOGLE_TOKEN_REQUIRED");
  }

  let payload: Record<string, unknown> | undefined;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: normalizedToken,
      audience: clientId,
    });
    payload = (ticket.getPayload() || undefined) as Record<string, unknown> | undefined;
  } catch {
    throw new GoogleIdentityError(401, "Invalid Google ID token", "GOOGLE_TOKEN_INVALID");
  }

  const sub = String(payload?.sub || "").trim();
  if (!sub) {
    throw new GoogleIdentityError(401, "Google token payload is missing subject", "GOOGLE_SUB_MISSING");
  }

  const hostedDomain = String(payload?.hd || "").trim() || undefined;
  const allowedHostedDomain = String(process.env.GOOGLE_ALLOWED_HOSTED_DOMAIN || "").trim();
  if (allowedHostedDomain && hostedDomain !== allowedHostedDomain) {
    throw new GoogleIdentityError(403, "Google account is not in the allowed domain", "GOOGLE_HD_FORBIDDEN");
  }

  return {
    providerUserId: sub,
    email: String(payload?.email || "").trim() || undefined,
    emailVerified: Boolean(payload?.email_verified),
    fullName: String(payload?.name || "").trim() || undefined,
    avatarUrl: String(payload?.picture || "").trim() || undefined,
    hostedDomain,
    rawProfile: payload || {},
  };
}
