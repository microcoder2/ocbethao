export type OrderCardProgressSegment = {
  key: string;
  tone: string;
  width: number;
};

export function buildOrderCardProgressSegments(
  segments: OrderCardProgressSegment[]
): OrderCardProgressSegment[] {
  return segments.filter((segment) => Number(segment.width || 0) > 0);
}
