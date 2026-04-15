export type CustomerCartLine = {
  key: string;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

const CART_STORAGE_KEY = "customer-cart-draft-v1";
const GUEST_COUNT_STORAGE_KEY = "customer-order-guest-count-v1";

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function loadCustomerCart(): CustomerCartLine[] {
  if (typeof window === "undefined") return [];
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  const raw = safeParse<any[]>(stored, []);
  return raw
    .map((line) => ({
      key: String(line.key || ""),
      menuItemId: Number(line.menuItemId || 0),
      name: String(line.name || ""),
      price: Number(line.price || 0),
      quantity: Number(line.quantity || 0),
      note: String(line.note || ""),
    }))
    .filter((line) => line.key && line.menuItemId > 0 && line.quantity > 0);
}

export function saveCustomerCart(lines: CustomerCartLine[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
}

export function clearCustomerCart(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(CART_STORAGE_KEY);
}

export function loadCustomerGuestCountDraft(): string {
  if (typeof window === "undefined") return "";

  const stored = window.localStorage.getItem(GUEST_COUNT_STORAGE_KEY);
  const parsed = Number.parseInt(String(stored || "").trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
}

export function saveCustomerGuestCountDraft(value: string): void {
  if (typeof window === "undefined") return;

  const parsed = Number.parseInt(String(value || "").trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    window.localStorage.removeItem(GUEST_COUNT_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(GUEST_COUNT_STORAGE_KEY, String(parsed));
}

export function clearCustomerGuestCountDraft(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(GUEST_COUNT_STORAGE_KEY);
}
