type Decimalish =
  | number
  | string
  | { toNumber?: () => number; toString?: () => string }
  | null
  | undefined;

export function toNumber(value: Decimalish): number | null {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value.toNumber === "function") {
    return value.toNumber();
  }
  if (typeof value.toString === "function") {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
