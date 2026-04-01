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
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeOrder, serializeOrderList } from "../utils/mappers";
import {
  broadcastStockUpdate,
  broadcastNewOrder,
  broadcastOrderChanged,
  type OrderChangeField,
  type OrderChangeType,
} from "../socket";

class OrderItemInput {
  dailyMenuItemId?: number;
  menuItemId?: number;
  quantity!: number;
  note?: string;
  status?: OrderItemStatus;
}

class CreateOrderBody {
  dailyMenuId?: number;
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

type ResolvedOrderLine = {
  menuItemId: number | null;
  dailyMenuItemId: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  waitingQuantity: number;
  cookingQuantity: number;
  readyQuantity: number;
  cancelledQuantity: number;
  status: OrderItemStatus;
  lineTotal: number;
  note?: string;
  stockUsage: Array<{
    dailyStockPoolId: number;
    quantity: number;
  }>;
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
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OBT-${stamp}-${rand}`;
}

function canEditOrder(status: OrderStatus): boolean {
  return status !== OrderStatus.COMPLETED && status !== OrderStatus.CANCELLED;
}

function getOrderItemKey(
  dailyMenuItemId: number | null | undefined,
  menuItemId: number | null | undefined
) {
  return `${dailyMenuItemId ?? "none"}:${menuItemId ?? "none"}`;
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
    dailyMenuItemId?: number | null;
    menuItemId?: number | null;
    quantity: number;
    note?: string | null;
  }>
) {
  return [...(items || [])]
    .map((item) => ({
      dailyMenuItemId:
        typeof item.dailyMenuItemId === "number" ? item.dailyMenuItemId : null,
      menuItemId: typeof item.menuItemId === "number" ? item.menuItemId : null,
      quantity: normalizePositiveInt(item.quantity),
      note: String(item.note || "").trim(),
    }))
    .sort((a, b) => {
      if (a.dailyMenuItemId !== b.dailyMenuItemId) {
        return (a.dailyMenuItemId ?? 0) - (b.dailyMenuItemId ?? 0);
      }
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
        `${item.dailyMenuItemId ?? "none"}:${item.menuItemId ?? "none"}:${item.quantity}:${item.note}`
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
        stock.dailyStockPoolId,
        (usage.get(stock.dailyStockPoolId) || 0) + stock.quantity
      );
    }
  }
  return usage;
}

async function ensureStockAvailability(
  tx: Prisma.TransactionClient,
  usage: Map<number, number>
) {
  const stockPoolIds = Array.from(usage.keys());
  if (stockPoolIds.length === 0) {
    return;
  }

  const stockPools = await tx.dailyStockPool.findMany({
    where: { id: { in: stockPoolIds } },
  });
  const stockPoolMap = new Map(stockPools.map((pool) => [pool.id, pool]));

  for (const [dailyStockPoolId, requiredQuantity] of usage.entries()) {
    const pool = stockPoolMap.get(dailyStockPoolId);
    if (!pool || pool.isAvailable === false) {
      throw new Error("Nguon hang cua mon da tam dung phuc vu");
    }

    const remainingQuantity = Number(pool.quantity) - Number(pool.soldQuantity);
    if (remainingQuantity < requiredQuantity) {
      throw new Error("So luong ton kho cua mon khong con du");
    }
  }
}

async function applyStockUsage(
  tx: Prisma.TransactionClient,
  usage: Map<number, number>,
  direction: 1 | -1
) {
  for (const [dailyStockPoolId, quantity] of usage.entries()) {
    const pool = await tx.dailyStockPool.findUniqueOrThrow({
      where: { id: dailyStockPoolId },
    });
    const nextSoldQuantity = Math.max(
      0,
      Number(pool.soldQuantity) + quantity * direction
    );

    await tx.dailyStockPool.update({
      where: { id: dailyStockPoolId },
      data: {
        soldQuantity: money(nextSoldQuantity),
      },
    });
  }
}

async function resolveOrderLines(
  tx: Prisma.TransactionClient,
  items: OrderItemInput[]
): Promise<ResolvedOrderLine[]> {
  const dailyMenuItemIds = Array.from(
    new Set(
      (items || [])
        .map((item) => item.dailyMenuItemId)
        .filter((value): value is number => typeof value === "number")
    )
  );
  const menuItemIds = Array.from(
    new Set(
      (items || [])
        .map((item) => item.menuItemId)
        .filter((value): value is number => typeof value === "number")
    )
  );

  const [dailyMenuItems, menuItems] = await Promise.all([
    dailyMenuItemIds.length
      ? tx.dailyMenuItem.findMany({
          where: { id: { in: dailyMenuItemIds } },
          include: {
            menuItem: true,
            stockLinks: true,
          },
        })
      : Promise.resolve([]),
    menuItemIds.length
      ? tx.menuItem.findMany({
          where: { id: { in: menuItemIds } },
        })
      : Promise.resolve([]),
  ]);

  const dailyMenuItemMap = new Map(dailyMenuItems.map((item) => [item.id, item]));
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));

  return (items || []).map((item) => {
    const quantity = normalizePositiveInt(item.quantity);

    if (item.dailyMenuItemId) {
      const dailyMenuItem = dailyMenuItemMap.get(item.dailyMenuItemId);
      if (!dailyMenuItem || !dailyMenuItem.isAvailable) {
        throw new Error("Mon trong menu ngay khong con kha dung");
      }

      if (!dailyMenuItem.menuItem) {
        throw new Error("Mon mau cua menu ngay khong ton tai");
      }

      const stockLinks = dailyMenuItem.stockLinks || [];
      if (stockLinks.length === 0) {
        throw new Error("Mon trong menu ngay chua duoc gan nguon hang");
      }

      const unitPrice = Number(
        dailyMenuItem.overridePrice ?? dailyMenuItem.menuItem.basePrice
      );
      const stageData = buildStageData(quantity, item.status ?? OrderItemStatus.WAITING);
      return {
        menuItemId: dailyMenuItem.menuItemId,
        dailyMenuItemId: dailyMenuItem.id,
        itemNameSnapshot: dailyMenuItem.menuItem.name,
        unitPrice,
        quantity,
        waitingQuantity: stageData.waitingQuantity,
        cookingQuantity: stageData.cookingQuantity,
        readyQuantity: stageData.readyQuantity,
        cancelledQuantity: stageData.cancelledQuantity,
        status: stageData.status,
        lineTotal: unitPrice * quantity,
        note: item.note,
        stockUsage: stockLinks.map((link) => ({
          dailyStockPoolId: link.dailyStockPoolId,
          quantity: Number(link.consumeQuantity) * quantity,
        })),
      };
    }

    if (item.menuItemId) {
      const menuItem = menuItemMap.get(item.menuItemId);
      if (!menuItem || !menuItem.isAvailable) {
        throw new Error("Mon mau khong con kha dung");
      }

      const unitPrice = Number(menuItem.basePrice);
      const stageData = buildStageData(quantity, item.status ?? OrderItemStatus.WAITING);
      return {
        menuItemId: menuItem.id,
        dailyMenuItemId: null,
        itemNameSnapshot: menuItem.name,
        unitPrice,
        quantity,
        waitingQuantity: stageData.waitingQuantity,
        cookingQuantity: stageData.cookingQuantity,
        readyQuantity: stageData.readyQuantity,
        cancelledQuantity: stageData.cancelledQuantity,
        status: stageData.status,
        lineTotal: unitPrice * quantity,
        note: item.note,
        stockUsage: [],
      };
    }

    throw new Error("Each order item must include dailyMenuItemId or menuItemId");
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
    dailyMenuId: true,
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
        dailyMenuItemId: true,
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
        include: {
          dailyMenuItem: {
            include: {
              stockLinks: true,
            },
          },
        },
      },
    },
  });
}

function getStockUsageFromOrder(order: Awaited<ReturnType<typeof getOrderForStockSync>>) {
  return getStockUsageFromOrderItems(order.items);
}

function getStockUsageFromOrderItems(
  items: Array<{
    quantity: number;
    status?: OrderItemStatus | string | null;
    waitingQuantity?: number | null;
    cookingQuantity?: number | null;
    readyQuantity?: number | null;
    cancelledQuantity?: number | null;
    dailyMenuItem?: {
      stockLinks?: Array<{
        dailyStockPoolId: number;
        consumeQuantity: Prisma.Decimal | number;
      }>;
    } | null;
  }>
) {
  const usage = new Map<number, number>();
  for (const item of items) {
    const activeQuantity = getActiveQuantity(getItemStageQuantities(item));
    if (activeQuantity <= 0) {
      continue;
    }

    const stockLinks = item.dailyMenuItem?.stockLinks || [];
    for (const link of stockLinks) {
      usage.set(
        link.dailyStockPoolId,
        (usage.get(link.dailyStockPoolId) || 0) +
          Number(link.consumeQuantity) * activeQuantity
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
            include: { dailyMenuItem: { include: { stockLinks: true } } },
          },
        },
      });

      const stockUsage = getStockUsageFromOrder(
        orderWithStocks as Awaited<ReturnType<typeof getOrderForStockSync>>
      );
      await applyStockUsage(tx, stockUsage, -1);
      cancelPoolIds = Array.from(stockUsage.keys());

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
            include: {
              dailyMenuItem: {
                include: {
                  stockLinks: true,
                },
              },
            },
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
      await applyStockUsage(tx, itemUsage, -1);
      cancelPoolIds = Array.from(itemUsage.keys());

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

      const remainingActiveItems = current.items.filter((item) => item.id !== itemId);
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
            include: {
              dailyMenuItem: {
                include: {
                  stockLinks: true,
                },
              },
            },
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
          dailyMenuItem: targetItem.dailyMenuItem,
        },
      ]);

      if (quantityDelta > 0) {
        await ensureStockAvailability(tx, usageDelta);
        await applyStockUsage(tx, usageDelta, 1);
      } else if (quantityDelta < 0) {
        await applyStockUsage(tx, usageDelta, -1);
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
            include: { dailyMenuItem: { include: { stockLinks: true } } },
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
      changedFields = Array.from(nextChangedFields);

      const currentUsage = getStockUsageFromOrder(
        current as Awaited<ReturnType<typeof getOrderForStockSync>>
      );
      await applyStockUsage(tx, currentUsage, -1);

      const lines = await resolveOrderLines(tx, body.items);
      const nextUsage = aggregateStockUsage(lines);
      await ensureStockAvailability(tx, nextUsage);

      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
      const serviceFee = Number(current.serviceFee);
      const discountAmount = Number(current.discountAmount);
      const totalAmount = subtotal + serviceFee - discountAmount;
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      await tx.order.update({
        where: { id },
        data: {
          arrivalAt: arrivalAt ?? undefined,
          subtotal: money(subtotal),
          totalAmount: money(totalAmount),
          items: {
            create: lines.map((line) => ({
              menuItemId: line.menuItemId,
              dailyMenuItemId: line.dailyMenuItemId,
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
      });

      await applyStockUsage(tx, nextUsage, 1);
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
          dailyMenuId: body.dailyMenuId,
          items: {
            create: lines.map((line) => ({
              menuItemId: line.menuItemId,
              dailyMenuItemId: line.dailyMenuItemId,
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
      });

      await applyStockUsage(tx, stockUsage, 1);
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
            include: {
              dailyMenuItem: {
                include: {
                  stockLinks: true,
                },
              },
            },
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
        await applyStockUsage(tx, stockUsage, -1);
        statusPoolIds = Array.from(stockUsage.keys());
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
        await applyStockUsage(tx, restoreUsage, 1);
        statusPoolIds = Array.from(restoreUsage.keys());

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
            include: {
              dailyMenuItem: {
                include: {
                  stockLinks: true,
                },
              },
            },
          },
        },
      });

      if (!canEditOrder(current.status)) {
        throw new Error("Chi co the sua don chua hoan tat hoac chua huy");
      }

      const currentUsage = getStockUsageFromOrder(current as Awaited<
        ReturnType<typeof getOrderForStockSync>
      >);
      await applyStockUsage(tx, currentUsage, -1);

      const lines = await resolveOrderLines(tx, body.items || []);
      const nextUsage = aggregateStockUsage(lines);
      await ensureStockAvailability(tx, nextUsage);

      const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
      const serviceFee = Number(current.serviceFee);
      const discountAmount = Number(current.discountAmount);
      const totalAmount = subtotal + serviceFee - discountAmount;
      const existingItems = new Map(
        current.items.map((item) => [
          getOrderItemKey(item.dailyMenuItemId, item.menuItemId),
          item,
        ])
      );

      await tx.orderItem.deleteMany({
        where: { orderId: id },
      });

      await tx.order.update({
        where: { id },
        data: {
          arrivalAt: arrivalAt ?? undefined,
          subtotal: money(subtotal),
          totalAmount: money(totalAmount),
          items: {
            create: lines.map((line) => ({
              ...buildReplacementStageData(
                existingItems.get(
                  getOrderItemKey(line.dailyMenuItemId, line.menuItemId)
                ),
                line.quantity
              ),
              menuItemId: line.menuItemId,
              dailyMenuItemId: line.dailyMenuItemId,
              itemNameSnapshot: line.itemNameSnapshot,
              unitPrice: money(line.unitPrice),
              quantity: line.quantity,
              lineTotal: money(line.lineTotal),
              note: line.note,
            })),
          },
        },
      });

      await applyStockUsage(tx, nextUsage, 1);
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
            include: {
              dailyMenuItem: {
                include: {
                  stockLinks: true,
                },
              },
            },
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
          dailyMenuItem: {
            include: {
              stockLinks: true,
            },
          },
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
        await applyStockUsage(tx, itemUsage, 1);
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
    const changeType = getAdminItemChangeType(
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
