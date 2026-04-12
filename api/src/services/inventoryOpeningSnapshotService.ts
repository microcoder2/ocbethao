import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeIngredientStock } from "../utils/mappers";

export const INVENTORY_OPENING_SNAPSHOT_ACTION = "INVENTORY_DAILY_OPENING_SNAPSHOT";

export type InventoryOpeningSnapshotItem = {
  ingredientId: number;
  ingredientName: string;
  unit: string | null;
  quantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  isAvailable: boolean;
  note: string | null;
};

export type InventoryOpeningSnapshot = {
  day: string;
  capturedAt: string;
  totalRemainingQuantity: number;
  items: InventoryOpeningSnapshotItem[];
};

export type InventoryOpeningSnapshotCaptureActor = {
  userId?: number | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type InventoryOpeningSnapshotCaptureResult = {
  created: boolean;
  snapshot: InventoryOpeningSnapshot;
};

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function getLocalDayKey(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function isInventoryOpeningSnapshot(value: unknown): value is InventoryOpeningSnapshot {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as InventoryOpeningSnapshot).day === "string" &&
      typeof (value as InventoryOpeningSnapshot).capturedAt === "string" &&
      Array.isArray((value as InventoryOpeningSnapshot).items)
  );
}

function toOpeningSnapshotPayload(
  items: InventoryOpeningSnapshotItem[],
  day = new Date(),
  capturedAt = new Date()
): InventoryOpeningSnapshot {
  return {
    day: getLocalDayKey(day),
    capturedAt: capturedAt.toISOString(),
    totalRemainingQuantity: items.reduce((sum, item) => sum + Number(item.remainingQuantity || 0), 0),
    items,
  };
}

async function readSnapshotByDay(day: Date): Promise<InventoryOpeningSnapshot | null> {
  const existing = await prisma.auditLog.findFirst({
    where: {
      action: INVENTORY_OPENING_SNAPSHOT_ACTION,
      createdAt: {
        gte: startOfLocalDay(day),
        lte: endOfLocalDay(day),
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const meta = existing?.meta;
  if (!isInventoryOpeningSnapshot(meta)) {
    return null;
  }

  return meta;
}

export async function getInventoryOpeningSnapshot(day = new Date()) {
  return readSnapshotByDay(day);
}

export async function captureInventoryOpeningSnapshot(
  day = new Date(),
  actor?: InventoryOpeningSnapshotCaptureActor,
  options?: {
    force?: boolean;
  }
): Promise<InventoryOpeningSnapshotCaptureResult> {
  const existing = await readSnapshotByDay(day);
  if (existing && !options?.force) {
    return {
      created: false,
      snapshot: existing,
    };
  }

  const stocks = await prisma.ingredientStock.findMany({
    include: { ingredient: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });

  const items = stocks.map((stock) => {
    const serialized = serializeIngredientStock(stock);
    return {
      ingredientId: serialized.ingredientId,
      ingredientName: serialized.ingredient?.name || serialized.label || "Nguyên liệu",
      unit: serialized.ingredient?.unit ?? null,
      quantity: Number(serialized.quantity || 0),
      soldQuantity: Number(serialized.soldQuantity || 0),
      remainingQuantity: Number(serialized.remainingQuantity || 0),
      isAvailable: Boolean(serialized.isAvailable),
      note: serialized.note ?? null,
    };
  });

  const payload = toOpeningSnapshotPayload(items, day, new Date());

  await prisma.auditLog.create({
    data: {
      userId: actor?.userId ?? null,
      ip: actor?.ip ?? null,
      userAgent: actor?.userAgent ?? null,
      action: INVENTORY_OPENING_SNAPSHOT_ACTION,
      meta: payload as unknown as Prisma.InputJsonValue,
    },
  });

  return {
    created: true,
    snapshot: payload,
  };
}

export function getInventoryOpeningSnapshotItem(snapshot: InventoryOpeningSnapshot | null, ingredientId: number) {
  if (!snapshot) {
    return null;
  }

  return snapshot.items.find((item) => item.ingredientId === ingredientId) || null;
}
