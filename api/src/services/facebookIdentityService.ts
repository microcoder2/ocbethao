import crypto from "crypto";

export class FacebookIdentityError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string
  ) {
    super(message);
  }
}

export type VerifiedFacebookIdentity = {
  providerUserId: string;
  email?: string;
  emailVerified: boolean;
  fullName?: string;
  avatarUrl?: string;
  rawProfile: Record<string, unknown>;
};

type FacebookGraphErrorPayload = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
  };
};

type FacebookDebugTokenResponse = FacebookGraphErrorPayload & {
  data?: {
    app_id?: string;
    type?: string;
    application?: string;
    expires_at?: number;
    is_valid?: boolean;
    issued_at?: number;
    scopes?: string[];
    user_id?: string;
  };
};

type FacebookMeResponse = FacebookGraphErrorPayload & {
  id?: string;
  name?: string;
  email?: string;
  picture?: {
    data?: {
      url?: string;
    };
  };
};

const DEFAULT_FACEBOOK_GRAPH_VERSION = "v22.0";

function cleanNullable(value: unknown): string | undefined {
  const normalized = String(value || "").trim();
  return normalized || undefined;
}

function getFacebookAppId(): string {
  return String(process.env.FACEBOOK_APP_ID || "").trim();
}

function getFacebookAppSecret(): string {
  return String(process.env.FACEBOOK_APP_SECRET || "").trim();
}

function getFacebookGraphVersion(): string {
  return String(process.env.FACEBOOK_GRAPH_VERSION || DEFAULT_FACEBOOK_GRAPH_VERSION).trim();
}

export function isFacebookConfigured(): boolean {
  return Boolean(getFacebookAppId() && getFacebookAppSecret());
}

function buildGraphUrl(path: string, params: Record<string, string>): string {
  const searchParams = new URLSearchParams(params);
  return `https://graph.facebook.com/${getFacebookGraphVersion()}/${path}?${searchParams.toString()}`;
}

function mapGraphError(
  payload: FacebookGraphErrorPayload | null | undefined,
  fallbackMessage: string
): FacebookIdentityError {
  const message = cleanNullable(payload?.error?.message) || fallbackMessage;
  const code = cleanNullable(payload?.error?.type) || "FACEBOOK_GRAPH_ERROR";
  const errorCode = Number(payload?.error?.code || 0);
  const status = errorCode === 190 ? 401 : 502;
  return new FacebookIdentityError(status, message, code);
}

async function fetchFacebookJson<T extends FacebookGraphErrorPayload>(
  path: string,
  params: Record<string, string>,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(buildGraphUrl(path, params), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  let payload: T | null = null;
  try {
    payload = (await response.json()) as T;
  } catch {
    payload = null;
  }

  if (!response.ok || payload?.error) {
    throw mapGraphError(payload, fallbackMessage);
  }

  return payload as T;
}

function buildAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac("sha256", appSecret).update(accessToken).digest("hex");
}

export async function verifyFacebookAccessToken(
  accessToken: string
): Promise<VerifiedFacebookIdentity> {
  const appId = getFacebookAppId();
  const appSecret = getFacebookAppSecret();

  if (!appId || !appSecret) {
    throw new FacebookIdentityError(
      503,
      "Facebook login is not configured",
      "FACEBOOK_NOT_CONFIGURED"
    );
  }

  const normalizedToken = String(accessToken || "").trim();
  if (!normalizedToken) {
    throw new FacebookIdentityError(
      400,
      "Missing Facebook access token",
      "FACEBOOK_TOKEN_REQUIRED"
    );
  }

  const debugResponse = await fetchFacebookJson<FacebookDebugTokenResponse>(
    "debug_token",
    {
      input_token: normalizedToken,
      access_token: `${appId}|${appSecret}`,
    },
    "Unable to verify Facebook access token"
  );

  const tokenData = debugResponse.data;
  if (!tokenData?.is_valid) {
    throw new FacebookIdentityError(
      401,
      "Invalid Facebook access token",
      "FACEBOOK_TOKEN_INVALID"
    );
  }

  if (String(tokenData.app_id || "") !== appId) {
    throw new FacebookIdentityError(
      403,
      "Facebook token was issued for another app",
      "FACEBOOK_APP_MISMATCH"
    );
  }

  const profile = await fetchFacebookJson<FacebookMeResponse>(
    "me",
    {
      fields: "id,name,email,picture.type(large)",
      access_token: normalizedToken,
      appsecret_proof: buildAppSecretProof(normalizedToken, appSecret),
    },
    "Unable to load Facebook profile"
  );

  const providerUserId = cleanNullable(profile.id || tokenData.user_id);
  if (!providerUserId) {
    throw new FacebookIdentityError(
      401,
      "Facebook profile is missing user id",
      "FACEBOOK_USER_ID_MISSING"
    );
  }

  return {
    providerUserId,
    email: cleanNullable(profile.email),
    emailVerified: false,
    fullName: cleanNullable(profile.name),
    avatarUrl: cleanNullable(profile.picture?.data?.url),
    rawProfile: {
      tokenData,
      profile,
    },
  };
}
