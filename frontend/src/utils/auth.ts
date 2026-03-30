export type AuthUser = {
  id: number;
  fullName: string;
  role: string;
  username?: string | null;
  phone?: string | null;
  email?: string | null;
  customerType?: string | null;
  preferredAuthProvider?: string | null;
  linkedAuthProviders?: string[];
};

const memoryStore: Record<string, string> = {};

function notifyAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("auth:changed"));
}

function getStorageCandidates(): Storage[] {
  const stores: Storage[] = [];
  if (typeof window === "undefined") {
    return stores;
  }

  if (window.localStorage) {
    stores.push(window.localStorage);
  }
  if (window.sessionStorage) {
    stores.push(window.sessionStorage);
  }

  return stores;
}

function readValue(key: string): string {
  for (const store of getStorageCandidates()) {
    try {
      const value = store.getItem(key);
      if (value !== null) {
        return value;
      }
    } catch {
      // Try next storage backend.
    }
  }
  return memoryStore[key] || "";
}

function writeValue(key: string, value: string): void {
  let wrote = false;
  for (const store of getStorageCandidates()) {
    try {
      store.setItem(key, value);
      wrote = true;
    } catch {
      // Try next storage backend.
    }
  }

  if (!wrote) {
    memoryStore[key] = value;
  } else {
    memoryStore[key] = value;
  }
}

function removeValue(key: string): void {
  for (const store of getStorageCandidates()) {
    try {
      store.removeItem(key);
    } catch {
      // Ignore storage removal errors.
    }
  }
  delete memoryStore[key];
}

export function getToken(): string {
  return readValue("accessToken");
}

export function getUser(): AuthUser | null {
  try {
    const raw = readValue("user");
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function getRole(): string {
  return String(getUser()?.role || "").toUpperCase();
}

export function isAuthenticated(): boolean {
  return Boolean(getToken());
}

export function saveAuth(payload: {
  accessToken?: string;
  user?: AuthUser;
}): void {
  if (payload.accessToken) {
    writeValue("accessToken", payload.accessToken);
  }
  if (payload.user) {
    writeValue("user", JSON.stringify(payload.user));
  }
  notifyAuthChanged();
}

export function logout(): void {
  removeValue("accessToken");
  removeValue("user");
  notifyAuthChanged();
}
