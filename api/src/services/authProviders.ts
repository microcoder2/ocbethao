export type AuthProviderKind = "password" | "oauth" | "oidc" | "national_id";
export type AuthProviderPublicConfig = Record<string, string | boolean | number | null>;

export type AuthProviderDefinition = {
  key: string;
  label: string;
  kind: AuthProviderKind;
  supportsLogin: boolean;
  supportsLink: boolean;
  isEnabled: boolean;
  isLinkEnabled?: boolean;
  isReady: boolean;
  notes?: string;
  publicConfig?: AuthProviderPublicConfig;
};

type AuthProviderTemplate = Omit<
  AuthProviderDefinition,
  "isEnabled" | "isReady" | "supportsLink"
> & {
  supportsLink?: boolean;
};

const AUTH_PROVIDER_DEFINITIONS: AuthProviderTemplate[] = [
  {
    key: "password",
    label: "Password",
    kind: "password",
    supportsLogin: true,
    notes: "Username, phone, or email with password.",
  },
  {
    key: "google",
    label: "Google",
    kind: "oidc",
    supportsLogin: true,
    supportsLink: true,
    notes: "Requires GOOGLE_CLIENT_ID.",
  },
  {
    key: "facebook",
    label: "Facebook",
    kind: "oauth",
    supportsLogin: true,
    supportsLink: true,
  },
  {
    key: "apple",
    label: "Apple",
    kind: "oidc",
    supportsLogin: true,
    supportsLink: true,
  },
  {
    key: "zalo",
    label: "Zalo",
    kind: "oauth",
    supportsLogin: true,
    supportsLink: true,
  },
  {
    key: "vneid",
    label: "VNeID",
    kind: "national_id",
    supportsLogin: true,
    supportsLink: true,
  },
];

const LOCAL_IDENTITY_PROVIDERS = new Set(["username", "phone", "email"]);

function parseProviderList(value: string | undefined, fallback: string[]): Set<string> {
  const rawValues = String(value || "")
    .split(",")
    .map((item) => normalizeProvider(item))
    .filter(Boolean);

  return new Set(rawValues.length > 0 ? rawValues : fallback);
}

function getGoogleClientId(): string {
  return String(process.env.GOOGLE_CLIENT_ID || "").trim();
}

function getFacebookAppId(): string {
  return String(process.env.FACEBOOK_APP_ID || "").trim();
}

function getFacebookAppSecret(): string {
  return String(process.env.FACEBOOK_APP_SECRET || "").trim();
}

function getFacebookGraphVersion(): string {
  return String(process.env.FACEBOOK_GRAPH_VERSION || "v22.0").trim();
}

function getFacebookLoginScope(): string {
  return String(process.env.FACEBOOK_LOGIN_SCOPE || "public_profile,email").trim();
}

function buildRuntimeProvider(provider: AuthProviderTemplate): AuthProviderDefinition {
  const loginEnabledProviders = parseProviderList(
    process.env.AUTH_ENABLED_LOGIN_PROVIDERS,
    ["password"]
  );
  const linkEnabledProviders = parseProviderList(
    process.env.AUTH_ENABLED_LINK_PROVIDERS,
    ["google"]
  );

  const isEnabled = loginEnabledProviders.has(provider.key);
  const isLinkEnabled = Boolean(provider.supportsLink) && linkEnabledProviders.has(provider.key);

  if (provider.key === "password") {
    return {
      ...provider,
      supportsLink: false,
      isEnabled,
      isLinkEnabled: false,
      isReady: true,
    };
  }

  if (provider.key === "google") {
    const clientId = getGoogleClientId();
    return {
      ...provider,
      supportsLink: Boolean(provider.supportsLink),
      isEnabled,
      isLinkEnabled,
      isReady: Boolean(clientId),
      notes: clientId ? provider.notes : "Set GOOGLE_CLIENT_ID to enable Google sign-in.",
      publicConfig: clientId
        ? {
            clientId,
            uxMode: "popup",
          }
        : undefined,
    };
  }

  if (provider.key === "facebook") {
    const appId = getFacebookAppId();
    const appSecret = getFacebookAppSecret();
    const isReady = Boolean(appId && appSecret);

    return {
      ...provider,
      supportsLink: Boolean(provider.supportsLink),
      isEnabled,
      isLinkEnabled,
      isReady,
      notes: isReady
        ? "Requires Meta app to allow Facebook Login for Web."
        : "Set FACEBOOK_APP_ID and FACEBOOK_APP_SECRET to enable Facebook sign-in.",
      publicConfig: appId
        ? {
            appId,
            version: getFacebookGraphVersion(),
            scope: getFacebookLoginScope(),
          }
        : undefined,
    };
  }

  return {
    ...provider,
    supportsLink: Boolean(provider.supportsLink),
    isEnabled,
    isLinkEnabled,
    isReady: false,
  };
}

export function getAuthProviders(): AuthProviderDefinition[] {
  return AUTH_PROVIDER_DEFINITIONS.map(buildRuntimeProvider);
}

export function getAuthProvider(provider: string): AuthProviderDefinition | null {
  const normalized = normalizeProvider(provider);
  if (!normalized) {
    return null;
  }
  return getAuthProviders().find((item) => item.key === normalized) || null;
}

export function normalizeProvider(provider: string | null | undefined): string {
  return String(provider || "")
    .trim()
    .toLowerCase();
}

export function isLocalIdentityProvider(provider: string): boolean {
  return LOCAL_IDENTITY_PROVIDERS.has(normalizeProvider(provider));
}

export function getLocalIdentityProviders(): string[] {
  return Array.from(LOCAL_IDENTITY_PROVIDERS);
}

export function getExternalProviderKeys(): string[] {
  return AUTH_PROVIDER_DEFINITIONS.filter((provider) => provider.key !== "password").map(
    (provider) => provider.key
  );
}
