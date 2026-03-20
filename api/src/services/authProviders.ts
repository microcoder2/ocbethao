export type AuthProviderKind = "password" | "oauth" | "oidc" | "national_id";

export type AuthProviderDefinition = {
  key: string;
  label: string;
  kind: AuthProviderKind;
  supportsLogin: boolean;
  supportsLink: boolean;
  isEnabled: boolean;
  isReady: boolean;
  notes?: string;
};

const AUTH_PROVIDER_DEFINITIONS: AuthProviderDefinition[] = [
  {
    key: "password",
    label: "Password",
    kind: "password",
    supportsLogin: true,
    supportsLink: false,
    isEnabled: true,
    isReady: true,
    notes: "Username, phone, or email with password.",
  },
  {
    key: "google",
    label: "Google",
    kind: "oidc",
    supportsLogin: true,
    supportsLink: true,
    isEnabled: true,
    isReady: false,
  },
  {
    key: "facebook",
    label: "Facebook",
    kind: "oauth",
    supportsLogin: true,
    supportsLink: true,
    isEnabled: true,
    isReady: false,
  },
  {
    key: "apple",
    label: "Apple",
    kind: "oidc",
    supportsLogin: true,
    supportsLink: true,
    isEnabled: true,
    isReady: false,
  },
  {
    key: "zalo",
    label: "Zalo",
    kind: "oauth",
    supportsLogin: true,
    supportsLink: true,
    isEnabled: true,
    isReady: false,
  },
  {
    key: "vneid",
    label: "VNeID",
    kind: "national_id",
    supportsLogin: true,
    supportsLink: true,
    isEnabled: true,
    isReady: false,
  },
];

const PROVIDER_MAP = new Map(
  AUTH_PROVIDER_DEFINITIONS.map((provider) => [provider.key, provider])
);

const LOCAL_IDENTITY_PROVIDERS = new Set(["username", "phone", "email"]);

export function getAuthProviders(): AuthProviderDefinition[] {
  return AUTH_PROVIDER_DEFINITIONS.map((provider) => ({ ...provider }));
}

export function getAuthProvider(provider: string): AuthProviderDefinition | null {
  const normalized = normalizeProvider(provider);
  return normalized ? PROVIDER_MAP.get(normalized) || null : null;
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
