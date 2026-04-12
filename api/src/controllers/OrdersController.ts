import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";
import {
  InventoryMovementType,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { formatOrderNumber } from "../utils/orderNumber";
import { serializeOrder, serializeOrderList } from "../utils/mappers";
import { loadCurrentIngredientStocks } from "../services/catalogService";
import {
  broadcastStockUpdate,
  broadcastNewOrder,
  broadcastOrderChanged,
  type OrderChangeField,
  type OrderChangeType,
} from "../socket";

class OrderItemInput {
  menuItemId?: number;
  quantity!: number;
  note?: string;
  status?: OrderItemStatus;
}

class CreateOrderBody {
  customerId?: number;
  assignedStaffId?: number;
  tableLabel?: string;
  guestCount?: number;
  guestName?: string;
  guestPhone?: string;
  note?: string;
  internalNote?: string;
  arrivalAt?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  serviceFee?: number;
  discountAmount?: number;
  items!: OrderItemInput[];
}

class UpdateOrderStatusBody {
  status!: OrderStatus;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  assignedStaffId?: number;
  internalNote?: string;
  arrivalAt?: string;
}

class UpdateOrderBody {
  items!: OrderItemInput[];
  arrivalAt?: string;
  guestCount?: number;
}

class UpdateOrderItemStageBody {
  action!: "MOVE_STAGE";
  fromStage!: "WAITING" | "COOKING" | "READY" | "CANCELLED";
  toStage!: "WAITING" | "COOKING" | "READY";
  quantity!: number;
}

class UpdateMyOrderItemQuantityBody {
  quantity!: number;
}

class UpdateOrderItemStatusResponse {
  success!: boolean;
  id!: number;
  status!: OrderItemStatus;
  quantity!: number;
  waitingQuantity!: number;
  cookingQuantity!: number;
  readyQuantity!: number;
  cancelledQuantity!: number;
  subtotal!: number;
  totalAmount!: number;
  itemProgress!: {
    total: number;
    waiting: number;
    cooking: number;
    ready: number;
    cancelled: number;
  };
}

class MutationAckResponse {
  success!: boolean;
  message!: string;
}

type ItemStageName = "WAITING" | "COOKING" | "READY" | "CANCELLED";

type ItemStageQuantities = {
  waitingQuantity: number;
  cookingQuantity: number;
  readyQuantity: number;
  cancelledQuantity: number;
};

type StockUsageEntry = {
  ingredientId: number;
  consumeQuantity: number;
  quantity: number;
};

type ResolvedOrderLine = {
  menuItemId: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  waitingQuantity: number;
  cookingQuantity: number;
  readyQuantity: number;
  cancelledQuantity: number;
  status: OrderItemStatus;
  lineTotal: number;
  note: string | undefined;
  stockUsage: StockUsageEntry[];
};

type IngredientStockLookup = {
  id: number;
  ingredientId: number;
  quantity: number | Prisma.Decimal;
  soldQuantity: number | Prisma.Decimal;
  isAvailable: boolean;
  label?: string | null;
};

type StockTrackedOrderItem = {
  id?: number;
  quantity: number;
  itemNameSnapshot?: string;
  unitPrice?: number | Prisma.Decimal;
  status?: OrderItemStatus | string | null;
  waitingQuantity?: number | null;
  cookingQuantity?: number | null;
  readyQuantity?: number | null;
  cancelledQuantity?: number | null;
  menuItemId?: number | null;
  note?: string | null;
  menuItem?: {
    ingredientPresets?: Array<{
      ingredientId: number;
      consumeQuantity: Prisma.Decimal | number | null;
    }>;
  } | null;
  consumptions?: Array<{
    ingredientId: number;
    consumeQuantity: Prisma.Decimal | number | null;
  }>;
};

const orderItemStockInclude = {
  menuItem: {
    include: {
      ingredientPresets: {
        select: {
          ingredientId: true,
          consumeQuantity: true,
        },
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
      },
    },
  },
  consumptions: {
    select: {
      ingredientId: true,
      consumeQuantity: true,
    },
  },
};

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function getDateRange(date: string) {
  const normalized = String(date || "").trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(`${normalized}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Ngay loc khong hop le");
  }

  const nextDay = new Date(parsed);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    gte: parsed,
    lt: nextDay,
  };
}

function buildOrderNumber(): string {
  return formatOrderNumber(new Date());
}

function canEditOrder(status: OrderStatus): boolean {
  return status !== OrderStatus.COMPLETED && status !== OrderStatus.CANCELLED;
}

function normalizeOrderItemNote(note?: string | null) {
  return String(note || "").trim();
}

function getOrderItemKey(
  menuItemId: number | null | undefined,
  note?: string | null
) {
  return `${menuItemId ?? "none"}:${normalizeOrderItemNote(note)}`;
}

function getAdminOrderChangeType(status: OrderStatus): OrderChangeType | null {
  if (status === OrderStatus.CONFIRMED) return "ADMIN_CONFIRMED_ORDER";
  if (status === OrderStatus.COMPLETED) return "ADMIN_COMPLETED_ORDER";
  if (status === OrderStatus.CANCELLED) return "ADMIN_CANCELLED_ORDER";
  return null;
}

function getAdminItemChangeType(status: OrderItemStatus): OrderChangeType | null {
  if (status === OrderItemStatus.COOKING) return "ADMIN_ITEM_COOKING";
  if (status === OrderItemStatus.READY) return "ADMIN_ITEM_READY";
  return null;
}

function getStageField(stage: ItemStageName) {
  if (stage === "WAITING") return "waitingQuantity" as const;
  if (stage === "COOKING") return "cookingQuantity" as const;
  if (stage === "READY") return "readyQuantity" as const;
  return "cancelledQuantity" as const;
}

function buildLegacyStageQuantities(
  quantity: number,
  status: OrderItemStatus = OrderItemStatus.WAITING
): ItemStageQuantities {
  if (status === OrderItemStatus.CANCELLED) {
    return {
      waitingQuantity: 0,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: quantity,
    };
  }

  if (status === OrderItemStatus.READY) {
    return {
      waitingQuantity: 0,
      cookingQuantity: 0,
      readyQuantity: quantity,
      cancelledQuantity: 0,
    };
  }

  if (status === OrderItemStatus.COOKING) {
    return {
      waitingQuantity: 0,
      cookingQuantity: quantity,
      readyQuantity: 0,
      cancelledQuantity: 0,
    };
  }

  return {
    waitingQuantity: quantity,
    cookingQuantity: 0,
    readyQuantity: 0,
    cancelledQuantity: 0,
  };
}

function getItemStageQuantities(item: {
  quantity: number;
  status?: OrderItemStatus | string | null;
  waitingQuantity?: number | null;
  cookingQuantity?: number | null;
  readyQuantity?: number | null;
  cancelledQuantity?: number | null;
}): ItemStageQuantities {
  const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
  const waitingQuantity = Math.max(0, Number(item.waitingQuantity || 0));
  const cookingQuantity = Math.max(0, Number(item.cookingQuantity || 0));
  const readyQuantity = Math.max(0, Number(item.readyQuantity || 0));
  const cancelledQuantity = Math.max(0, Number(item.cancelledQuantity || 0));
  const sum =
    waitingQuantity + cookingQuantity + readyQuantity + cancelledQuantity;

  if (sum <= 0) {
    return buildLegacyStageQuantities(
      quantity,
      (item.status as OrderItemStatus | null) ?? OrderItemStatus.WAITING
    );
  }

  return {
    waitingQuantity,
    cookingQuantity,
    readyQuantity,
    cancelledQuantity,
  };
}

function getActiveQuantity(stages: ItemStageQuantities) {
  return stages.waitingQuantity + stages.cookingQuantity + stages.readyQuantity;
}

function getActiveLineTotal(item: {
  unitPrice: number | Prisma.Decimal;
  quantity: number;
  status?: OrderItemStatus | string | null;
  waitingQuantity?: number | null;
  cookingQuantity?: number | null;
  readyQuantity?: number | null;
  cancelledQuantity?: number | null;
}) {
  return Number(item.unitPrice || 0) * getActiveQuantity(getItemStageQuantities(item));
}

function deriveOrderItemStatus(
  quantity: number,
  stages: ItemStageQuantities
): OrderItemStatus {
  if (stages.cancelledQuantity >= quantity && quantity > 0) {
    return OrderItemStatus.CANCELLED;
  }

  if (
    stages.readyQuantity >= quantity &&
    stages.waitingQuantity === 0 &&
    stages.cookingQuantity === 0 &&
    quantity > 0
  ) {
    return OrderItemStatus.READY;
  }

  if (stages.cookingQuantity > 0 || stages.readyQuantity > 0) {
    return OrderItemStatus.COOKING;
  }

  return OrderItemStatus.WAITING;
}

function buildStageData(
  quantity: number,
  status: OrderItemStatus = OrderItemStatus.WAITING
) {
  const stages = buildLegacyStageQuantities(quantity, status);
  return {
    ...stages,
    status: deriveOrderItemStatus(quantity, stages),
  };
}

function canUpdateWaitingOnlyQuantity(item: {
  quantity: number;
  status?: OrderItemStatus | string | null;
  waitingQuantity?: number | null;
  cookingQuantity?: number | null;
  readyQuantity?: number | null;
  cancelledQuantity?: number | null;
}) {
  const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
  const stages = getItemStageQuantities(item);
  return (
    stages.waitingQuantity === quantity &&
    stages.cookingQuantity === 0 &&
    stages.readyQuantity === 0 &&
    stages.cancelledQuantity === 0
  );
}

function buildReplacementStageData(
  currentItem: {
    quantity: number;
    status?: OrderItemStatus | string | null;
    waitingQuantity?: number | null;
    cookingQuantity?: number | null;
    readyQuantity?: number | null;
    cancelledQuantity?: number | null;
  } | undefined,
  nextQuantity: number
) {
  if (!currentItem) {
    return buildStageData(nextQuantity, OrderItemStatus.WAITING);
  }

  if (canUpdateWaitingOnlyQuantity(currentItem)) {
    return buildStageData(nextQuantity, OrderItemStatus.WAITING);
  }

  if (Math.floor(Number(currentItem.quantity || 0)) !== nextQuantity) {
    throw new Error("Khong the doi so luong mon da vao bep hoac da huy");
  }

  const stages = getItemStageQuantities(currentItem);
  return {
    ...stages,
    status: deriveOrderItemStatus(nextQuantity, stages),
  };
}

function buildPersistedOrderLine(item: StockTrackedOrderItem): ResolvedOrderLine {
  const stages = getItemStageQuantities(item);
  const activeQuantity = getActiveQuantity(stages);
  const quantity = Math.max(0, Math.floor(Number(item.quantity || 0)));
  const unitPrice = Number(item.unitPrice || 0);

  return {
    menuItemId: item.menuItemId ?? null,
    itemNameSnapshot: String(item.itemNameSnapshot || ""),
    unitPrice,
    quantity,
    waitingQuantity: stages.waitingQuantity,
    cookingQuantity: stages.cookingQuantity,
    readyQuantity: stages.readyQuantity,
    cancelledQuantity: stages.cancelledQuantity,
    status: deriveOrderItemStatus(quantity, stages),
    lineTotal: unitPrice * quantity,
    note: normalizeOrderItemNote(item.note) || undefined,
    stockUsage: buildStockUsageEntriesForItem(item, activeQuantity),
  };
}

function buildUpdatedWaitingOrderLine(
  item: StockTrackedOrderItem,
  nextQuantity: number
): ResolvedOrderLine {
  const quantity = Math.max(0, Math.floor(Number(nextQuantity || 0)));
  const unitPrice = Number(item.unitPrice || 0);
  const stages = buildStageData(quantity, OrderItemStatus.WAITING);

  return {
    menuItemId: item.menuItemId ?? null,
    itemNameSnapshot: String(item.itemNameSnapshot || ""),
    unitPrice,
    quantity,
    waitingQuantity: stages.waitingQuantity,
    cookingQuantity: stages.cookingQuantity,
    readyQuantity: stages.readyQuantity,
    cancelledQuantity: stages.cancelledQuantity,
    status: stages.status,
    lineTotal: unitPrice * quantity,
    note: normalizeOrderItemNote(item.note) || undefined,
    stockUsage: buildStockUsageEntriesForItem(item, quantity),
  };
}

async function buildFinalOrderLinesFromDiff(
  tx: Prisma.TransactionClient,
  currentItems: StockTrackedOrderItem[],
  incomingItems: OrderItemInput[]
) {
  const currentBuckets = new Map<string, StockTrackedOrderItem[]>();
  for (const item of currentItems) {
    const key = getOrderItemKey(item.menuItemId, item.note);
    const bucket = currentBuckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      currentBuckets.set(key, [item]);
    }
  }

  const newInputs: OrderItemInput[] = [];
  const plan: Array<
    | { kind: "existing"; line: ResolvedOrderLine }
    | { kind: "new"; index: number }
  > = [];

  for (const rawItem of incomingItems) {
    const key = getOrderItemKey(
      typeof rawItem.menuItemId === "number" ? rawItem.menuItemId : null,
      rawItem.note
    );
    const currentItem = currentBuckets.get(key)?.shift();
    const nextQuantity = normalizePositiveInt(rawItem.quantity);

    if (currentItem) {
      const currentQuantity = Math.max(0, Math.floor(Number(currentItem.quantity || 0)));
      if (currentQuantity === nextQuantity) {
        plan.push({ kind: "existing", line: buildPersistedOrderLine(currentItem) });
        continue;
      }

      if (!canUpdateWaitingOnlyQuantity(currentItem)) {
        throw new Error("Khong the doi so luong mon da vao bep hoac da huy");
      }

      plan.push({
        kind: "existing",
        line: buildUpdatedWaitingOrderLine(currentItem, nextQuantity),
      });
      continue;
    }

    newInputs.push(rawItem);
    plan.push({ kind: "new", index: newInputs.length - 1 });
  }

  const newLines = newInputs.length
    ? await resolveOrderLines(tx, newInputs)
    : [];
  let newLineIndex = 0;

  return plan.map((entry) =>
    entry.kind === "existing" ? entry.line : newLines[newLineIndex++]
  );
}

function buildItemProgress(
  items: Array<{
    quantity: number;
    waitingQuantity?: number | null;
    cookingQuantity?: number | null;
    readyQuantity?: number | null;
    cancelledQuantity?: number | null;
    status?: OrderItemStatus | string | null;
  }>
) {
  return items.reduce(
    (progress, item) => {
      const stages = getItemStageQuantities(item);
      progress.waiting += stages.waitingQuantity;
      progress.cooking += stages.cookingQuantity;
      progress.ready += stages.readyQuantity;
      progress.cancelled += stages.cancelledQuantity;
      progress.total += getActiveQuantity(stages);
      return progress;
    },
    {
      total: 0,
      waiting: 0,
      cooking: 0,
      ready: 0,
      cancelled: 0,
    }
  );
}

function moveItemStageQuantity(
  stages: ItemStageQuantities,
  fromStage: ItemStageName,
  toStage: Exclude<ItemStageName, "CANCELLED">,
  quantity: number
) {
  if (fromStage === toStage) {
    throw new Error("Khong the chuyen cung mot trang thai");
  }

  const fromField = getStageField(fromStage);
  const toField = getStageField(toStage);
  const availableQuantity = stages[fromField];
  if (availableQuantity < quantity) {
    throw new Error("So luong mon trong trang thai nguon khong du");
  }

  return {
    ...stages,
    [fromField]: availableQuantity - quantity,
    [toField]: stages[toField] + quantity,
  } satisfies ItemStageQuantities;
}

function parseOptionalDateTime(value: unknown, fieldName: string) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new Error(`${fieldName} khong hop le`);
    }
    return value;
  }

  const normalized = String(value).trim();
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} khong hop le`);
  }

  return parsed;
}

function normalizePositiveInt(value: number): number {
  const normalized = Math.floor(Number(value || 0));
  if (!Number.isFinite(normalized) || normalized <= 0) {
    throw new Error("So luong mon phai lon hon 0");
  }
  return normalized;
}

function buildOrderItemsSignature(
  items: Array<{
    menuItemId?: number | null;
    quantity: number;
    note?: string | null;
  }>
) {
  return [...(items || [])]
    .map((item) => ({
      menuItemId: typeof item.menuItemId === "number" ? item.menuItemId : null,
      quantity: normalizePositiveInt(item.quantity),
      note: normalizeOrderItemNote(item.note),
    }))
    .sort((a, b) => {
      if (a.menuItemId !== b.menuItemId) {
        return (a.menuItemId ?? 0) - (b.menuItemId ?? 0);
      }
      if (a.quantity !== b.quantity) {
        return a.quantity - b.quantity;
      }
      return a.note.localeCompare(b.note);
    })
    .map(
      (item) =>
        `${item.menuItemId ?? "none"}:${item.quantity}:${item.note}`
    )
    .join("|");
}

function isSameDateTime(a?: Date | null, b?: Date | null) {
  return (a?.getTime() ?? null) === (b?.getTime() ?? null);
}

function aggregateStockUsage(lines: ResolvedOrderLine[]) {
  const usage = new Map<number, number>();
  for (const line of lines) {
    for (const stock of line.stockUsage) {
      usage.set(
        stock.ingredientId,
        (usage.get(stock.ingredientId) || 0) + stock.quantity
      );
    }
  }
  return usage;
}

function computeAvailableQuantityFromIngredientStocks(
  presets: Array<{
    ingredientId: number;
    consumeQuantity: number | Prisma.Decimal;
  }>,
  stockMap: Map<number, IngredientStockLookup>
) {
  if (!presets.length) {
    return null;
  }

  let capacity = Number.POSITIVE_INFINITY;
  for (const preset of presets) {
    const stock = stockMap.get(preset.ingredientId);
    if (!stock || stock.isAvailable === false) {
      return 0;
    }

    const consumeQuantity = Math.max(Number(preset.consumeQuantity || 0), 0);
    if (consumeQuantity <= 0) {
      continue;
    }

    const remainingQuantity = Math.max(
      Number(stock.quantity || 0) - Number(stock.soldQuantity || 0),
      0
    );
    capacity = Math.min(capacity, Math.floor(remainingQuantity / consumeQuantity));
  }

  return Number.isFinite(capacity) ? Math.max(capacity, 0) : null;
}

function formatUnavailableMenuItemMessage(params: {
  itemName: string;
  menuItemId: number | null;
  requestedQuantity: number;
  availableQuantity: number;
}) {
  return [
    "Món trong menu ngày không còn khả dụng.",
    `- Món: ${params.itemName}`,
    `- menuItemId: ${params.menuItemId ?? "null"}`,
    `- Còn tối đa: ${params.availableQuantity}`,
    `- Số lượng đặt: ${params.requestedQuantity}`,
  ].join("\n");
}

function buildResolvedLineStockUsage(
  line: Pick<ResolvedOrderLine, "stockUsage">,
  activeQuantity: number
) {
  const normalizedActiveQuantity = Math.max(0, Math.floor(Number(activeQuantity || 0)));
  if (normalizedActiveQuantity <= 0) {
    return [] as StockUsageEntry[];
  }

  return (line.stockUsage || [])
    .map((stock) => ({
      ...stock,
      quantity: Number(stock.consumeQuantity || 0) * normalizedActiveQuantity,
    }))
    .filter((stock) => stock.quantity > 0);
}

function buildStockUsageEntriesForItem(
  item: StockTrackedOrderItem,
  activeQuantityOverride?: number
) {
  const activeQuantity =
    typeof activeQuantityOverride === "number"
      ? Math.max(0, Math.floor(activeQuantityOverride))
      : getActiveQuantity(getItemStageQuantities(item));

  if (activeQuantity <= 0) {
    return [] as StockUsageEntry[];
  }

  const consumptions = Array.isArray(item.consumptions) ? item.consumptions : [];
  if (consumptions.length) {
    return consumptions
      .map((consumption) => {
        const consumeQuantity = Number(consumption.consumeQuantity || 0);
        return {
          ingredientId: consumption.ingredientId,
          consumeQuantity,
          quantity: consumeQuantity * activeQuantity,
        } satisfies StockUsageEntry;
      })
      .filter((entry) => entry.ingredientId > 0 && entry.quantity > 0);
  }

  const ingredientPresets = item.menuItem?.ingredientPresets || [];
  if (ingredientPresets.length) {
    return ingredientPresets
      .map((preset) => {
        const consumeQuantity = Number(preset.consumeQuantity || 0);
        return {
          ingredientId: preset.ingredientId,
          consumeQuantity,
          quantity: consumeQuantity * activeQuantity,
        } satisfies StockUsageEntry;
      })
      .filter((entry) => entry.ingredientId > 0 && entry.quantity > 0);
  }

  return [] as StockUsageEntry[];
}

async function ensureStockAvailability(
  tx: Prisma.TransactionClient,
  usage: Map<number, number>,
  lines?: ResolvedOrderLine[]
) {
  const ingredientIds = Array.from(usage.keys());
  if (ingredientIds.length === 0) {
    return;
  }

  const stockPools = await tx.ingredientStock.findMany({
    where: { ingredientId: { in: ingredientIds } },
  });
  const stockPoolMap = new Map(stockPools.map((pool) => [pool.ingredientId, pool]));

  for (const [ingredientId, requiredQuantity] of usage.entries()) {
    const pool = stockPoolMap.get(ingredientId);
    if (!pool || pool.isAvailable === false) {
      throw new Error("Nguồn hàng của món đã tạm dừng phục vụ");
    }

    const remainingQuantity = Number(pool.quantity) - Number(pool.soldQuantity);
    if (remainingQuantity < requiredQuantity) {
      const affectedLines =
        lines?.filter((line) =>
          line.stockUsage.some((stock) => stock.ingredientId === ingredientId)
        ) ?? [];

      const lineSummary = affectedLines.length
        ? affectedLines
            .map((line) => {
              const stockUsage = line.stockUsage.find(
                (stock) => stock.ingredientId === ingredientId
              );
              const lineRequiredQuantity = Number(stockUsage?.quantity || 0);
              const lineConsumeQuantity = Number(stockUsage?.consumeQuantity || 0);
              return `- Món: ${line.itemNameSnapshot} | menuItemId: ${line.menuItemId ?? "null"} | số lượng đặt: ${line.quantity} | cần từ kho: ${lineRequiredQuantity} (định mức ${lineConsumeQuantity}/món)`;
            })
            .join("\n")
        : "- Không xác định được món liên quan từ danh sách đơn.";

      throw new Error(
        [
          "Tồn kho không đủ cho món trong đơn.",
          `- Kho ingredientId ${ingredientId}: còn ${remainingQuantity}, cần ${requiredQuantity}.`,
          lineSummary,
        ].join("\n")
      );
    }
  }
}

async function applyStockUsage(
  tx: Prisma.TransactionClient,
  usage: Map<number, number>,
  direction: 1 | -1,
  audit?: {
    movementType: InventoryMovementType;
    orderId?: number | null;
    orderItemId?: number | null;
    createdById?: number | null;
    note?: string | null;
  }
) {
  const movementIdsByPool = new Map<number, number>();
  const ingredientIds = Array.from(usage.keys());
  if (ingredientIds.length === 0) {
    return movementIdsByPool;
  }

  const pools = await tx.ingredientStock.findMany({
    where: { ingredientId: { in: ingredientIds } },
    select: {
      id: true,
      ingredientId: true,
      soldQuantity: true,
    },
  });
  const poolMap = new Map(pools.map((pool) => [pool.ingredientId, pool]));

  for (const [ingredientId, quantity] of usage.entries()) {
    const pool = poolMap.get(ingredientId);
    if (!pool) {
      throw new Error("Khong tim thay nguon hang cua mon");
    }
    const nextSoldQuantity = Math.max(
      0,
      Number(pool.soldQuantity) + quantity * direction
    );

    await tx.ingredientStock.update({
      where: { ingredientId },
      data: {
        soldQuantity: money(nextSoldQuantity),
      },
    });

    if (audit && quantity > 0) {
      const movement = await tx.inventoryMovement.create({
        data: {
          ingredientId: pool.ingredientId,
          orderId: audit.orderId ?? null,
          orderItemId: audit.orderItemId ?? null,
          movementType: audit.movementType,
          quantityDelta: money(direction === 1 ? -quantity : quantity),
          note: audit.note ?? null,
          createdById: audit.createdById ?? null,
        },
      });
      movementIdsByPool.set(ingredientId, movement.id);
    }
  }

  return movementIdsByPool;
}

async function syncOrderItemConsumptions(
  tx: Prisma.TransactionClient,
  entries: Array<{
    orderItemId: number;
    stockUsage: StockUsageEntry[];
  }>,
  movementIdsByPool?: Map<number, number>
) {
  const orderItemIds = Array.from(
    new Set(
      entries
        .map((entry) => entry.orderItemId)
        .filter((value) => typeof value === "number" && value > 0)
    )
  );

  if (!orderItemIds.length) {
    return;
  }

  await tx.orderItemConsumption.deleteMany({
    where: {
      orderItemId: { in: orderItemIds },
    },
  });

  const rows = entries.flatMap((entry) =>
    entry.stockUsage
      .filter((stock) => stock.quantity > 0 && typeof stock.ingredientId === "number")
      .map((stock) => ({
        orderItemId: entry.orderItemId,
        ingredientId: Number(stock.ingredientId),
        inventoryMovementId:
          typeof stock.ingredientId === "number"
            ? movementIdsByPool?.get(stock.ingredientId) ?? null
            : null,
        consumeQuantity: money(stock.consumeQuantity),
        totalQuantity: money(stock.quantity),
      }))
  );

  if (!rows.length) {
    return;
  }

  await tx.orderItemConsumption.createMany({
    data: rows,
  });
}

async function resolveOrderLines(
  tx: Prisma.TransactionClient,
  items: OrderItemInput[]
): Promise<ResolvedOrderLine[]> {
  const normalizedItems = (items || []).map((item) => ({
    ...item,
    menuItemId:
      typeof item.menuItemId === "number" && item.menuItemId > 0
        ? item.menuItemId
        : undefined,
  }));

  const menuItemIds = Array.from(
    new Set(
      normalizedItems
        .map((item) => item.menuItemId)
        .filter((value): value is number => typeof value === "number")
    )
  );

  const [menuItems, ingredientStocks] = await Promise.all([
    menuItemIds.length
      ? tx.menuItem.findMany({
          where: { id: { in: menuItemIds } },
          include: {
            ingredientPresets: {
              include: { ingredient: true },
              orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            },
          },
        })
      : Promise.resolve([]),
    loadCurrentIngredientStocks(tx),
  ]);

  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
  const ingredientStockMap = new Map(
    ingredientStocks.map((stock) => [stock.ingredientId, stock])
  );

  return normalizedItems.map((item) => {
    const quantity = normalizePositiveInt(item.quantity);

    if (item.menuItemId) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable || menuItem.status !== "ACTIVE") {
        throw new Error("Mon mau khong con kha dung");
      }

      const availableQuantity = computeAvailableQuantityFromIngredientStocks(
        menuItem.ingredientPresets || [],
        ingredientStockMap
      );
      if (availableQuantity !== null && availableQuantity < quantity) {
        throw new Error(
          formatUnavailableMenuItemMessage({
            itemName: menuItem.name,
            menuItemId: menuItem.id,
            requestedQuantity: quantity,
            availableQuantity,
          })
        );
      }

      const unitPrice = Number(menuItem.currentPrice);
      const stageData = buildStageData(quantity, item.status ?? OrderItemStatus.WAITING);
      return {
        menuItemId: menuItem.id,
        itemNameSnapshot: menuItem.name,
        unitPrice,
        quantity,
        waitingQuantity: stageData.waitingQuantity,
        cookingQuantity: stageData.cookingQuantity,
        readyQuantity: stageData.readyQuantity,
        cancelledQuantity: stageData.cancelledQuantity,
        status: stageData.status,
        lineTotal: unitPrice * quantity,
        note: normalizeOrderItemNote(item.note) || undefined,
        stockUsage: (menuItem.ingredientPresets || []).map((preset) => {
          return {
            ingredientId: preset.ingredientId,
            consumeQuantity: Number(preset.consumeQuantity || 0),
            quantity: Number(preset.consumeQuantity || 0) * quantity,
          };
        }).filter((entry) => entry.quantity > 0),
      };
    }

    throw new Error("Each order item must include menuItemId");
  });
}

function pairOrderItemsWithResolvedLines(
  orderItems: Array<{
    id: number;
    menuItemId: number | null;
    note?: string | null;
  }>,
  lines: ResolvedOrderLine[]
) {
  const buckets = new Map<
    string,
    Array<{
      id: number;
      menuItemId: number | null;
      note?: string | null;
    }>
  >();

  for (const item of orderItems) {
    const key = getOrderItemKey(item.menuItemId, item.note);
    const current = buckets.get(key);
    if (current) {
      current.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }

  return lines.flatMap((line) => {
    const key = getOrderItemKey(line.menuItemId, line.note);
    const target = buckets.get(key)?.shift();
    if (!target) {
      return [];
    }
    return [{
      orderItemId: target.id,
      stockUsage: line.stockUsage,
    }];
  });
}

function buildOrderListSelect() {
  return {
    id: true,
    orderNumber: true,
    source: true,
    status: true,
    paymentStatus: true,
    paymentMethod: true,
    tableLabel: true,
    guestCount: true,
    guestName: true,
    guestPhone: true,
    arrivalAt: true,
    subtotal: true,
    serviceFee: true,
      discountAmount: true,
      totalAmount: true,
      createdAt: true,
      customer: {
      select: {
        fullName: true,
        phone: true,
      },
    },
    items: {
      orderBy: { id: "asc" as const },
        select: {
          id: true,
          menuItemId: true,
          itemNameSnapshot: true,
        unitPrice: true,
        quantity: true,
        waitingQuantity: true,
        cookingQuantity: true,
        readyQuantity: true,
        cancelledQuantity: true,
        status: true,
        lineTotal: true,
        note: true,
      },
    },
  };
}

async function getOrderDetail(id: number) {
  return prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      customer: true,
      assignedStaff: true,
      items: {
        include: {
          menuItem: {
            include: {
              category: true,
              ingredientPresets: {
                include: { ingredient: true },
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              },
              priceHistories: {
                orderBy: { effectiveFrom: "desc" },
                take: 1,
              },
            },
          },
        },
      },
    },
  });
}

async function getOrderForStockSync(id: number) {
  return prisma.order.findUniqueOrThrow({
    where: { id },
    include: {
      items: {
        include: orderItemStockInclude,
      },
    },
  });
}

function getStockUsageFromOrder(order: Awaited<ReturnType<typeof getOrderForStockSync>>) {
  return getStockUsageFromOrderItems(order.items);
}

function getStockUsageFromOrderItems(
  items: StockTrackedOrderItem[]
) {
  const usage = new Map<number, number>();
  for (const item of items) {
    const stockLinks = buildStockUsageEntriesForItem(item);
    for (const link of stockLinks) {
      usage.set(
        link.ingredientId,
        (usage.get(link.ingredientId) || 0) + link.quantity
      );
    }
  }
  return usage;
}

@Route("orders")
@Tags("Orders")
export class OrdersController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getOrders(
    @Query() status?: OrderStatus,
    @Query() paymentStatus?: PaymentStatus,
    @Query() search?: string,
    @Query() date?: string,
    @Query() scope?: string
  ) {
    const where: Prisma.OrderWhereInput = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (date?.trim()) {
      const dateRange = getDateRange(date.trim());
      if (dateRange) {
        where.createdAt = dateRange;
      }
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q } },
        { guestName: { contains: q } },
        { guestPhone: { contains: q } },
        { tableLabel: { contains: q } },
        { customer: { is: { fullName: { contains: q } } } },
        { customer: { is: { phone: { contains: q } } } },
      ];
    }

    if (scope === "attention" && !status && !paymentStatus) {
      where.AND = [
        { status: { not: OrderStatus.CANCELLED } },
        { status: OrderStatus.CONFIRMED },
      ];
    }

    const orders = await prisma.order.findMany({
      where,
      select: buildOrderListSelect(),
      orderBy: { createdAt: "desc" },
    });
    return orders.map(serializeOrderList);
  }

  @Get("my")
  @Security("bearerAuth", ["CUSTOMER"])
  public async getMyOrders(@Request() req: ExRequest) {
    const authUser = (req as any).user;
    const orders = await prisma.order.findMany({
      where: { customerId: authUser.id },
      include: {
        customer: true,
        assignedStaff: true,
        items: {
          include: {
            menuItem: {
              include: {
                category: true,
                ingredientPresets: {
                  include: { ingredient: true },
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                },
                priceHistories: {
                  orderBy: { effectiveFrom: "desc" },
                  take: 1,
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(serializeOrder);
  }

  @Put("my/{id}/cancel")
  @Security("bearerAuth", ["CUSTOMER"])
  public async cancelMyOrder(@Path() id: number, @Request() req: ExRequest) {
    const authUser = (req as any).user;

    let cancelPoolIds: number[] = [];
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({ where: { id } });

      if (current.customerId !== authUser.id) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }

      if (current.status !== OrderStatus.PENDING) {
        throw new Error("Chi co the huy don dang cho xac nhan");
      }

      const orderWithStocks = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      const stockUsage = getStockUsageFromOrder(
        orderWithStocks as Awaited<ReturnType<typeof getOrderForStockSync>>
      );
      await applyStockUsage(tx, stockUsage, -1, {
        movementType: InventoryMovementType.ORDER_RELEASE,
        orderId: current.id,
        createdById: authUser.id,
      });
      cancelPoolIds = Array.from(stockUsage.keys());

      await tx.orderItemConsumption.deleteMany({
        where: {
          orderItemId: { in: orderWithStocks.items.map((item) => item.id) },
        },
      });

      for (const item of orderWithStocks.items) {
        await tx.orderItem.update({
          where: { id: item.id },
          data: {
            waitingQuantity: 0,
            cookingQuantity: 0,
            readyQuantity: 0,
            cancelledQuantity: item.quantity,
            status: OrderItemStatus.CANCELLED,
          },
        });
      }

      await tx.order.update({
        where: { id },
        data: {
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.UNPAID,
          paymentMethod: null,
        },
      });
    });

    const order = await getOrderDetail(id);
    const serialized = serializeOrder(order);
    void broadcastStockUpdate(cancelPoolIds);
    broadcastOrderChanged(
      {
        type: "CUSTOMER_CANCELLED",
        order: serialized,
        occurredAt: new Date().toISOString(),
      },
      { roles: ["ADMIN", "STAFF"] }
    );
    return serialized;
  }

  @Put("my/{orderId}/items/{itemId}/cancel")
  @Security("bearerAuth", ["CUSTOMER"])
  public async cancelMyOrderItem(
    @Path() orderId: number,
    @Path() itemId: number,
    @Request() req: ExRequest
  ) {
    const authUser = (req as any).user;

    let cancelPoolIds: number[] = [];
    let cancelledItemName = "";
    let orderCancelled = false;

    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      if (current.customerId !== authUser.id) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }

      if (current.status !== OrderStatus.CONFIRMED) {
        throw new Error("Chi co the huy mon trong don da xac nhan");
      }

      const targetItem = current.items.find((item) => item.id === itemId);
      if (!targetItem) {
        throw new Error("Mon khong thuoc don hang");
      }

      if (!canUpdateWaitingOnlyQuantity(targetItem)) {
        throw new Error("Chi co the huy mon dang cho");
      }

      cancelledItemName = targetItem.itemNameSnapshot;
      const itemUsage = getStockUsageFromOrderItems([targetItem]);
      await applyStockUsage(tx, itemUsage, -1, {
        movementType: InventoryMovementType.ORDER_RELEASE,
        orderId: current.id,
        orderItemId: targetItem.id,
        createdById: authUser.id,
      });
      cancelPoolIds = Array.from(itemUsage.keys());

      await tx.orderItemConsumption.deleteMany({
        where: { orderItemId: targetItem.id },
      });

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          waitingQuantity: 0,
          cookingQuantity: 0,
          readyQuantity: 0,
          cancelledQuantity: targetItem.quantity,
          status: OrderItemStatus.CANCELLED,
        },
      });

      const remainingActiveItems = current.items.filter(
        (item) => item.id !== itemId && getActiveQuantity(getItemStageQuantities(item)) > 0
      );
      const nextSubtotal = remainingActiveItems.reduce(
        (sum, item) => sum + getActiveLineTotal(item),
        0
      );
      const serviceFee = Number(current.serviceFee || 0);
      const discountAmount = Number(current.discountAmount || 0);
      const nextTotalAmount = Math.max(0, nextSubtotal + serviceFee - discountAmount);

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: money(nextSubtotal),
          totalAmount: money(nextTotalAmount),
          ...(remainingActiveItems.length
            ? {}
            : {
                status: OrderStatus.CANCELLED,
                paymentStatus: PaymentStatus.UNPAID,
                paymentMethod: null,
              }),
        },
      });

      orderCancelled = remainingActiveItems.length === 0;
    });

    const order = await getOrderDetail(orderId);
    const serialized = serializeOrder(order);
    void broadcastStockUpdate(cancelPoolIds);
    broadcastOrderChanged(
      {
        type: "CUSTOMER_ITEM_CANCELLED",
        order: serialized,
        itemId,
        itemName: cancelledItemName,
        orderCancelled,
        occurredAt: new Date().toISOString(),
      },
      { roles: ["ADMIN", "STAFF"] }
    );
    return serialized;
  }

  @Put("my/{orderId}/items/{itemId}")
  @Security("bearerAuth", ["CUSTOMER"])
  public async updateMyOrderItemQuantity(
    @Path() orderId: number,
    @Path() itemId: number,
    @Request() req: ExRequest,
    @Body() body: UpdateMyOrderItemQuantityBody
  ) {
    const authUser = (req as any).user;
    const nextQuantity = normalizePositiveInt(body.quantity);

    let updatePoolIds: number[] = [];
    let changedFields: OrderChangeField[] = [];

    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      if (current.customerId !== authUser.id) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }

      if (current.status !== OrderStatus.CONFIRMED) {
        throw new Error("Chi co the cap nhat so luong mon trong don da xac nhan");
      }

      const targetItem = current.items.find((item) => item.id === itemId);
      if (!targetItem) {
        throw new Error("Mon khong thuoc don hang");
      }

      if (!canUpdateWaitingOnlyQuantity(targetItem)) {
        throw new Error("Chi co the cap nhat so luong mon dang cho");
      }

      if (targetItem.quantity === nextQuantity) {
        return;
      }

      const quantityDelta = nextQuantity - targetItem.quantity;
      const usageDelta = getStockUsageFromOrderItems([
        {
          quantity: Math.abs(quantityDelta),
          menuItem: targetItem.menuItem,
          consumptions: targetItem.consumptions,
        },
      ]);

      if (quantityDelta > 0) {
        await ensureStockAvailability(tx, usageDelta);
      }

      const nextLineTotal = Number(targetItem.unitPrice || 0) * nextQuantity;
      const nextSubtotal =
        Number(current.subtotal || 0) -
        Number(targetItem.lineTotal || 0) +
        nextLineTotal;
      const serviceFee = Number(current.serviceFee || 0);
      const discountAmount = Number(current.discountAmount || 0);
      const nextTotalAmount = Math.max(0, nextSubtotal + serviceFee - discountAmount);

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          quantity: nextQuantity,
          waitingQuantity: nextQuantity,
          cookingQuantity: 0,
          readyQuantity: 0,
          cancelledQuantity: 0,
          status: OrderItemStatus.WAITING,
          lineTotal: money(nextLineTotal),
        },
      });

      await tx.order.update({
        where: { id: orderId },
        data: {
          subtotal: money(nextSubtotal),
          totalAmount: money(nextTotalAmount),
        },
      });

      const movementIdsByPool = quantityDelta === 0
        ? new Map<number, number>()
        : await applyStockUsage(
            tx,
            usageDelta,
            quantityDelta > 0 ? 1 : -1,
            {
              movementType:
                quantityDelta > 0
                  ? InventoryMovementType.ORDER_RESERVE
                  : InventoryMovementType.ORDER_RELEASE,
              orderId: current.id,
              orderItemId: targetItem.id,
              createdById: authUser.id,
            }
          );

      await syncOrderItemConsumptions(tx, [{
        orderItemId: itemId,
        stockUsage: buildStockUsageEntriesForItem(targetItem, nextQuantity),
      }], movementIdsByPool);

      updatePoolIds = Array.from(usageDelta.keys());
      changedFields = ["items"];
    });

    const order = await getOrderDetail(orderId);
    const serialized = serializeOrder(order);
    void broadcastStockUpdate(updatePoolIds);
    if (changedFields.length) {
      broadcastOrderChanged(
        {
          type: "CUSTOMER_UPDATED",
          order: serialized,
          changedFields,
          occurredAt: new Date().toISOString(),
        },
        { roles: ["ADMIN", "STAFF"] }
      );
    }
    return serialized;
  }

  @Put("my/{id}")
  @Security("bearerAuth", ["CUSTOMER"])
  public async updateMyOrder(
    @Path() id: number,
    @Request() req: ExRequest,
    @Body() body: UpdateOrderBody
  ) {
    const authUser = (req as any).user;

    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("Don hang phai co it nhat mot mon");
    }

    const arrivalAt = parseOptionalDateTime(body.arrivalAt, "Gio hen");

    let updatePoolIds: number[] = [];
    let changedFields: OrderChangeField[] = [];
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      if (current.customerId !== authUser.id) {
        throw Object.assign(new Error("Forbidden"), { statusCode: 403 });
      }

      if (current.status !== OrderStatus.PENDING) {
        throw new Error("Chi co the sua don dang cho xac nhan");
      }

      const nextChangedFields = new Set<OrderChangeField>();
      if (
        buildOrderItemsSignature(current.items) !==
        buildOrderItemsSignature(body.items)
      ) {
        nextChangedFields.add("items");
      }
      if (!isSameDateTime(current.arrivalAt, arrivalAt)) {
        nextChangedFields.add("arrivalAt");
      }
      if (body.guestCount !== undefined && Number(body.guestCount) !== Number(current.guestCount || 0)) {
        nextChangedFields.add("guestCount");
      }
      changedFields = Array.from(nextChangedFields);

      const currentUsage = getStockUsageFromOrder(
        current as Awaited<ReturnType<typeof getOrderForStockSync>>
      );
      await applyStockUsage(tx, currentUsage, -1, {
        movementType: InventoryMovementType.ORDER_RELEASE,
        orderId: current.id,
        createdById: authUser.id,
      });

      const lines = await buildFinalOrderLinesFromDiff(
        tx,
        current.items as StockTrackedOrderItem[],
        body.items
      );
      const nextUsage = aggregateStockUsage(lines);
      await ensureStockAvailability(tx, nextUsage, lines);

      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
      const serviceFee = Number(current.serviceFee);
      const discountAmount = Number(current.discountAmount);
      const totalAmount = subtotal + serviceFee - discountAmount;
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          arrivalAt: arrivalAt ?? undefined,
          ...(body.guestCount !== undefined
            ? { guestCount: Math.max(0, Math.floor(Number(body.guestCount || 0))) }
            : {}),
          subtotal: money(subtotal),
          totalAmount: money(totalAmount),
          items: {
            create: lines.map((line) => ({
              menuItemId: line.menuItemId,
              itemNameSnapshot: line.itemNameSnapshot,
              unitPrice: money(line.unitPrice),
              quantity: line.quantity,
              waitingQuantity: line.waitingQuantity,
              cookingQuantity: line.cookingQuantity,
              readyQuantity: line.readyQuantity,
              cancelledQuantity: line.cancelledQuantity,
              status: line.status,
              lineTotal: money(line.lineTotal),
              note: line.note,
            })),
          },
        },
        include: {
          items: {
            select: {
              id: true,
              menuItemId: true,
              note: true,
            },
          },
        },
      });

      const reserveMovementIds = await applyStockUsage(tx, nextUsage, 1, {
        movementType: InventoryMovementType.ORDER_RESERVE,
        orderId: current.id,
        createdById: authUser.id,
      });

      await syncOrderItemConsumptions(
        tx,
        pairOrderItemsWithResolvedLines(updatedOrder.items, lines),
        reserveMovementIds
      );
      updatePoolIds = Array.from(
        new Set([...currentUsage.keys(), ...nextUsage.keys()])
      );
    });

    const order = await getOrderDetail(id);
    const serialized = serializeOrder(order);
    void broadcastStockUpdate(updatePoolIds);
    if (changedFields.length) {
      broadcastOrderChanged(
        {
          type: "CUSTOMER_UPDATED",
          order: serialized,
          changedFields,
          occurredAt: new Date().toISOString(),
        },
        { roles: ["ADMIN", "STAFF"] }
      );
    }
    return serialized;
  }

  @Get("{id}")
  @Security("bearerAuth", ["ADMIN", "STAFF", "CUSTOMER"])
  public async getOrderById(@Path() id: number, @Request() req: ExRequest) {
    const authUser = (req as any).user;
    const order = await getOrderDetail(id);

    if (authUser.role === "CUSTOMER" && order.customerId !== authUser.id) {
      this.setStatus(403);
      return { message: "Forbidden" };
    }

    return serializeOrder(order);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN", "STAFF", "CUSTOMER"])
  public async createOrder(
    @Request() req: ExRequest,
    @Body() body: CreateOrderBody
  ) {
    const authUser = (req as any).user;
    const arrivalAt = parseOptionalDateTime(body.arrivalAt, "Gio hen");

    const source =
      authUser.role === "CUSTOMER"
        ? OrderSource.CUSTOMER_APP
        : authUser.role === "STAFF"
          ? OrderSource.STAFF_POS
          : OrderSource.ADMIN_POS;

    const currentUser =
      authUser.role === "CUSTOMER"
        ? await prisma.user.findUnique({ where: { id: authUser.id } })
        : null;

    const { orderId, poolIds: createdPoolIds } = await prisma.$transaction(async (tx) => {
      const lines = await resolveOrderLines(tx, body.items || []);
      const stockUsage = aggregateStockUsage(lines);
      await ensureStockAvailability(tx, stockUsage);

      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
      const serviceFee = body.serviceFee ?? 0;
      const discountAmount = body.discountAmount ?? 0;
      const totalAmount = subtotal + serviceFee - discountAmount;

      const order = await tx.order.create({
        data: {
          orderNumber: buildOrderNumber(),
          source,
          status: authUser.role === "CUSTOMER" ? OrderStatus.PENDING : OrderStatus.CONFIRMED,
          paymentStatus: body.paymentStatus ?? PaymentStatus.UNPAID,
          paymentMethod: body.paymentMethod,
          tableLabel: body.tableLabel,
          guestCount: body.guestCount,
          guestName:
            body.guestName ||
            (authUser.role === "CUSTOMER" ? currentUser?.fullName : undefined),
          guestPhone:
            body.guestPhone ||
            (authUser.role === "CUSTOMER" ? currentUser?.phone ?? undefined : undefined),
          note: body.note,
          internalNote: body.internalNote,
          arrivalAt,
          subtotal: money(subtotal),
          serviceFee: money(serviceFee),
          discountAmount: money(discountAmount),
          totalAmount: money(totalAmount),
          createdById: authUser.id,
          assignedStaffId: body.assignedStaffId,
          customerId: authUser.role === "CUSTOMER" ? authUser.id : body.customerId,
          items: {
            create: lines.map((line) => ({
              menuItemId: line.menuItemId,
              itemNameSnapshot: line.itemNameSnapshot,
              unitPrice: money(line.unitPrice),
              quantity: line.quantity,
              waitingQuantity: line.waitingQuantity,
              cookingQuantity: line.cookingQuantity,
              readyQuantity: line.readyQuantity,
              cancelledQuantity: line.cancelledQuantity,
              status: line.status,
              lineTotal: money(line.lineTotal),
              note: line.note,
            })),
          },
        },
        include: {
          items: {
            select: {
              id: true,
              menuItemId: true,
              note: true,
            },
          },
        },
      });

      const reserveMovementIds = await applyStockUsage(tx, stockUsage, 1, {
        movementType: InventoryMovementType.ORDER_RESERVE,
        orderId: order.id,
        createdById: authUser.id,
      });

      await syncOrderItemConsumptions(
        tx,
        pairOrderItemsWithResolvedLines(order.items, lines),
        reserveMovementIds
      );
      return { orderId: order.id, poolIds: Array.from(stockUsage.keys()) };
    });

    const order = await getOrderDetail(orderId);
    const serialized = serializeOrder(order);
    void broadcastStockUpdate(createdPoolIds);
    broadcastNewOrder(serialized);
    this.setStatus(201);
    return serialized;
  }

  @Put("{id}/status")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async updateOrderStatus(
    @Path() id: number,
    @Body() body: UpdateOrderStatusBody
  ) {
    const arrivalAt = parseOptionalDateTime(body.arrivalAt, "Gio hen");
    const changeType = getAdminOrderChangeType(body.status);

    let statusPoolIds: number[] = [];
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id },
      });
      const orderWithStocks = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      const stockUsage = getStockUsageFromOrder(orderWithStocks as Awaited<
        ReturnType<typeof getOrderForStockSync>
      >);
      const movingToCancelled =
        current.status !== OrderStatus.CANCELLED && body.status === OrderStatus.CANCELLED;
      const reactivatingOrder =
        current.status === OrderStatus.CANCELLED && body.status !== OrderStatus.CANCELLED;
      const movingToCompleted =
        current.status !== OrderStatus.COMPLETED && body.status === OrderStatus.COMPLETED;

      if (body.status === OrderStatus.COMPLETED && current.status === OrderStatus.PENDING) {
        throw new Error("Don hang can duoc xac nhan truoc khi hoan tat");
      }

      if (movingToCompleted && !body.paymentMethod && !current.paymentMethod) {
        throw new Error("Can chon hinh thuc thanh toan khi hoan tat don");
      }

      if (movingToCancelled) {
        await applyStockUsage(tx, stockUsage, -1, {
          movementType: InventoryMovementType.ORDER_RELEASE,
          orderId: current.id,
        });
        statusPoolIds = Array.from(stockUsage.keys());
        await tx.orderItemConsumption.deleteMany({
          where: {
            orderItemId: { in: orderWithStocks.items.map((item) => item.id) },
          },
        });
      }

      const data: Prisma.OrderUpdateInput = {
        status: body.status,
        paymentStatus: body.paymentStatus,
        paymentMethod: body.paymentMethod,
        internalNote: body.internalNote,
        arrivalAt: arrivalAt ?? undefined,
        assignedStaff:
          typeof body.assignedStaffId === "number"
            ? { connect: { id: body.assignedStaffId } }
            : undefined,
      };

      if (body.status === OrderStatus.CONFIRMED && !current.confirmedAt) {
        data.confirmedAt = new Date();
      }
      if (body.status === OrderStatus.COMPLETED) {
        data.completedAt = current.completedAt ?? new Date();
        data.paymentStatus = PaymentStatus.PAID;
        data.paymentMethod = body.paymentMethod ?? current.paymentMethod;
        for (const item of orderWithStocks.items) {
          const stages = getItemStageQuantities(item);
          if (stages.cancelledQuantity >= item.quantity) {
            continue;
          }

          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              waitingQuantity: 0,
              cookingQuantity: 0,
              readyQuantity: item.quantity,
              cancelledQuantity: 0,
              status: OrderItemStatus.READY,
            },
          });
        }
      }

      if (body.status === OrderStatus.CANCELLED) {
        data.paymentStatus = PaymentStatus.UNPAID;
        data.paymentMethod = null;
        for (const item of orderWithStocks.items) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              waitingQuantity: 0,
              cookingQuantity: 0,
              readyQuantity: 0,
              cancelledQuantity: item.quantity,
              status: OrderItemStatus.CANCELLED,
            },
          });
        }
      }

      if (reactivatingOrder) {
        const restoreUsage = getStockUsageFromOrderItems(
          orderWithStocks.items.map((item) => ({
            ...item,
            waitingQuantity: item.quantity,
            cookingQuantity: 0,
            readyQuantity: 0,
            cancelledQuantity: 0,
          }))
        );
        await ensureStockAvailability(tx, restoreUsage);
        for (const item of orderWithStocks.items) {
          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              waitingQuantity: item.quantity,
              cookingQuantity: 0,
              readyQuantity: 0,
              cancelledQuantity: 0,
              status: OrderItemStatus.WAITING,
            },
          });
        }

        const restoreMovementIds = await applyStockUsage(tx, restoreUsage, 1, {
          movementType: InventoryMovementType.ORDER_RESTORE,
          orderId: current.id,
        });
        statusPoolIds = Array.from(restoreUsage.keys());

        await syncOrderItemConsumptions(
          tx,
          orderWithStocks.items.map((item) => ({
            orderItemId: item.id,
            stockUsage: buildStockUsageEntriesForItem(item, item.quantity),
          })),
          restoreMovementIds
        );
      }

      await tx.order.update({
        where: { id },
        data,
      });
    });

    const order = await getOrderDetail(id);
    const serialized = serializeOrder(order);
    void broadcastStockUpdate(statusPoolIds);
    if (changeType && typeof serialized.customerId === "number" && serialized.customerId > 0) {
      broadcastOrderChanged(
        {
          type: changeType,
          order: serialized,
          occurredAt: new Date().toISOString(),
        },
        { userIds: [serialized.customerId] }
      );
    }
    return serialized;
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateOrder(
    @Path() id: number,
    @Body() body: UpdateOrderBody
  ): Promise<MutationAckResponse> {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      throw new Error("Don hang phai co it nhat mot mon");
    }

    const arrivalAt = parseOptionalDateTime(body.arrivalAt, "Gio hen");

    let updatePoolIds: number[] = [];
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      if (!canEditOrder(current.status)) {
        throw new Error("Chi co the sua don chua hoan tat hoac chua huy");
      }

      const currentUsage = getStockUsageFromOrder(current as Awaited<
        ReturnType<typeof getOrderForStockSync>
      >);
      await applyStockUsage(tx, currentUsage, -1, {
        movementType: InventoryMovementType.ORDER_RELEASE,
        orderId: current.id,
      });

      const lines = await buildFinalOrderLinesFromDiff(
        tx,
        current.items as StockTrackedOrderItem[],
        body.items || []
      );
      const nextUsage = aggregateStockUsage(lines);
      await ensureStockAvailability(tx, nextUsage, lines);

      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
      const serviceFee = Number(current.serviceFee);
      const discountAmount = Number(current.discountAmount);
      const totalAmount = subtotal + serviceFee - discountAmount;

      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          arrivalAt: arrivalAt ?? undefined,
          ...(body.guestCount !== undefined
            ? { guestCount: Math.max(0, Math.floor(Number(body.guestCount || 0))) }
            : {}),
          subtotal: money(subtotal),
          totalAmount: money(totalAmount),
          items: {
            create: lines.map((line) => {
              return {
                waitingQuantity: line.waitingQuantity,
                cookingQuantity: line.cookingQuantity,
                readyQuantity: line.readyQuantity,
                cancelledQuantity: line.cancelledQuantity,
                status: line.status,
                menuItemId: line.menuItemId,
                itemNameSnapshot: line.itemNameSnapshot,
                unitPrice: money(line.unitPrice),
                quantity: line.quantity,
                lineTotal: money(line.lineTotal),
                note: line.note,
              };
            }),
          },
        },
        include: {
          items: {
            select: {
              id: true,
              menuItemId: true,
              note: true,
            },
          },
        },
      });

      const reserveMovementIds = await applyStockUsage(tx, nextUsage, 1, {
        movementType: InventoryMovementType.ORDER_RESERVE,
        orderId: current.id,
      });
      await syncOrderItemConsumptions(
        tx,
        pairOrderItemsWithResolvedLines(updatedOrder.items, lines),
        reserveMovementIds
      );
      updatePoolIds = Array.from(new Set([...currentUsage.keys(), ...nextUsage.keys()]));
    });

    void broadcastStockUpdate(updatePoolIds);
    return {
      success: true,
      message: "Da luu thay doi don hang",
    };
  }

  @Put("{orderId}/items/{itemId}/status")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async updateOrderItemStatus(
    @Path() orderId: number,
    @Path() itemId: number,
    @Body() body: UpdateOrderItemStageBody
  ): Promise<UpdateOrderItemStatusResponse> {
    let updatePoolIds: number[] = [];
    let itemName = "";
    const movedQuantity = normalizePositiveInt(body.quantity);

    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
        include: {
          items: {
            include: orderItemStockInclude,
          },
        },
      });

      if (order.status !== OrderStatus.CONFIRMED) {
        throw new Error("Chi co the cap nhat mon trong don dang xu ly");
      }

      const targetItem = await tx.orderItem.findFirstOrThrow({
        where: {
          id: itemId,
          orderId,
        },
        include: {
          ...orderItemStockInclude,
        },
      });
      itemName = targetItem.itemNameSnapshot;

      if (body.action !== "MOVE_STAGE") {
        throw new Error("Hanh dong cap nhat mon khong hop le");
      }

      const currentStages = getItemStageQuantities(targetItem);
      const availableQuantity = currentStages[getStageField(body.fromStage)];
      if (availableQuantity < movedQuantity) {
        throw new Error("So luong mon trong trang thai hien tai khong du");
      }

      let nextStages = currentStages;

      if (body.fromStage === "CANCELLED") {
        if (body.toStage !== "WAITING") {
          throw new Error("Mon da huy chi co the phuc hoi ve trang thai cho");
        }

        if (
          currentStages.cancelledQuantity !== targetItem.quantity ||
          movedQuantity !== targetItem.quantity
        ) {
          throw new Error("Chi co the phuc hoi toan bo mon da huy");
        }

        const itemUsage = getStockUsageFromOrderItems([
          {
            ...targetItem,
            waitingQuantity: targetItem.quantity,
            cookingQuantity: 0,
            readyQuantity: 0,
            cancelledQuantity: 0,
          },
        ]);
        await ensureStockAvailability(tx, itemUsage);
        const restoreMovementIds = await applyStockUsage(tx, itemUsage, 1, {
          movementType: InventoryMovementType.ORDER_RESTORE,
          orderId: order.id,
          orderItemId: targetItem.id,
        });
        updatePoolIds = Array.from(itemUsage.keys());

        const nextSubtotal = Number(order.subtotal || 0) + Number(targetItem.lineTotal || 0);
        const serviceFee = Number(order.serviceFee || 0);
        const discountAmount = Number(order.discountAmount || 0);
        const nextTotalAmount = Math.max(0, nextSubtotal + serviceFee - discountAmount);

        await tx.order.update({
          where: { id: orderId },
          data: {
            subtotal: money(nextSubtotal),
            totalAmount: money(nextTotalAmount),
          },
        });

        nextStages = {
          waitingQuantity: targetItem.quantity,
          cookingQuantity: 0,
          readyQuantity: 0,
          cancelledQuantity: 0,
        };

        await syncOrderItemConsumptions(tx, [{
          orderItemId: targetItem.id,
          stockUsage: buildStockUsageEntriesForItem(targetItem, targetItem.quantity),
        }], restoreMovementIds);
      } else {
        nextStages = moveItemStageQuantity(
          currentStages,
          body.fromStage,
          body.toStage,
          movedQuantity
        );
      }

      const nextStatus = deriveOrderItemStatus(targetItem.quantity, nextStages);
      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          waitingQuantity: nextStages.waitingQuantity,
          cookingQuantity: nextStages.cookingQuantity,
          readyQuantity: nextStages.readyQuantity,
          cancelledQuantity: nextStages.cancelledQuantity,
          status: nextStatus,
        },
      });
    });

    void broadcastStockUpdate(updatePoolIds);
    const changeType =
      body.fromStage === "CANCELLED" && body.toStage === "WAITING"
        ? "ADMIN_ITEM_RESTORED"
        : getAdminItemChangeType(
            body.toStage === "READY"
              ? OrderItemStatus.READY
              : body.toStage === "COOKING"
                ? OrderItemStatus.COOKING
                : OrderItemStatus.WAITING
          );
    const order = await getOrderDetail(orderId);
    const serialized = serializeOrder(order);
    const serializedItem = serialized.items.find((item) => item.id === itemId);
    if (changeType) {
      if (typeof serialized.customerId === "number" && serialized.customerId > 0) {
        broadcastOrderChanged(
          {
            type: changeType,
            order: serialized,
            itemId,
            itemName,
            quantity: movedQuantity,
            occurredAt: new Date().toISOString(),
          },
          { userIds: [serialized.customerId] }
        );
      }
    }

    return {
      success: true,
      id: itemId,
      status: serializedItem?.status ?? OrderItemStatus.WAITING,
      quantity: serializedItem?.quantity ?? 0,
      waitingQuantity: serializedItem?.waitingQuantity ?? 0,
      cookingQuantity: serializedItem?.cookingQuantity ?? 0,
      readyQuantity: serializedItem?.readyQuantity ?? 0,
      cancelledQuantity: serializedItem?.cancelledQuantity ?? 0,
      subtotal: Number(serialized.subtotal || 0),
      totalAmount: Number(serialized.totalAmount || 0),
      itemProgress: serialized.itemProgress,
    };
  }

  @Delete("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async deleteOrder(@Path() id: number): Promise<void> {
    const order = await prisma.order.findUniqueOrThrow({ where: { id } });
    if (order.status !== OrderStatus.CANCELLED) {
      this.setStatus(400);
      throw new Error("Chi co the xoa don da huy");
    }
    await prisma.orderItem.deleteMany({ where: { orderId: id } });
    await prisma.order.delete({ where: { id } });
    this.setStatus(204);
  }
}
