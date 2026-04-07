export type CustomerCartLine = {
  key: string;
  dailyMenuItemId?: number;
  menuItemId: number;
  name: string;
  price: number;
  quantity: number;
  note?: string;
};

const CART_STORAGE_KEY = "customer-cart-draft-v1";

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
      dailyMenuItemId: line.dailyMenuItemId ? Number(line.dailyMenuItemId) : undefined,
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
