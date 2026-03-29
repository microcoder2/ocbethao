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
import { serializeOrder } from "../utils/mappers";
import { broadcastStockUpdate, broadcastNewOrder } from "../socket";

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

class UpdateOrderItemStatusBody {
  status!: OrderItemStatus;
}

type ResolvedOrderLine = {
  menuItemId: number | null;
  dailyMenuItemId: number | null;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
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
      return {
        menuItemId: dailyMenuItem.menuItemId,
        dailyMenuItemId: dailyMenuItem.id,
        itemNameSnapshot: dailyMenuItem.menuItem.name,
        unitPrice,
        quantity,
        status: item.status ?? OrderItemStatus.WAITING,
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
      return {
        menuItemId: menuItem.id,
        dailyMenuItemId: null,
        itemNameSnapshot: menuItem.name,
        unitPrice,
        quantity,
        status: item.status ?? OrderItemStatus.WAITING,
        lineTotal: unitPrice * quantity,
        note: item.note,
        stockUsage: [],
      };
    }

    throw new Error("Each order item must include dailyMenuItemId or menuItemId");
  });
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
  const usage = new Map<number, number>();
  for (const item of order.items) {
    const stockLinks = item.dailyMenuItem?.stockLinks || [];
    for (const link of stockLinks) {
      usage.set(
        link.dailyStockPoolId,
        (usage.get(link.dailyStockPoolId) || 0) +
          Number(link.consumeQuantity) * item.quantity
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

      if (
        current.status !== OrderStatus.PENDING &&
        current.status !== OrderStatus.CONFIRMED
      ) {
        throw new Error("Chi co the huy don dang cho xac nhan hoac da xac nhan");
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

      await tx.orderItem.updateMany({
        where: { orderId: id },
        data: { status: OrderItemStatus.CANCELLED },
      });

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
    void broadcastStockUpdate(cancelPoolIds);
    return serializeOrder(order);
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
      const existingStatuses = new Map(
        current.items.map((item) => [
          getOrderItemKey(item.dailyMenuItemId, item.menuItemId),
          item.status,
        ])
      );

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
              status:
                existingStatuses.get(
                  getOrderItemKey(line.dailyMenuItemId, line.menuItemId)
                ) ?? line.status,
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
    void broadcastStockUpdate(updatePoolIds);
    return serializeOrder(order);
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

      if (reactivatingOrder) {
        await ensureStockAvailability(tx, stockUsage);
        await applyStockUsage(tx, stockUsage, 1);
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
        await tx.orderItem.updateMany({
          where: {
            orderId: id,
            status: { not: OrderItemStatus.CANCELLED },
          },
          data: {
            status: OrderItemStatus.READY,
          },
        });
      }

      if (body.status === OrderStatus.CANCELLED) {
        data.paymentStatus = PaymentStatus.UNPAID;
        data.paymentMethod = null;
        await tx.orderItem.updateMany({
          where: { orderId: id },
          data: {
            status: OrderItemStatus.CANCELLED,
          },
        });
      }

      await tx.order.update({
        where: { id },
        data,
      });
    });

    const order = await getOrderDetail(id);
    void broadcastStockUpdate(statusPoolIds);
    return serializeOrder(order);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateOrder(@Path() id: number, @Body() body: UpdateOrderBody) {
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
      const existingStatuses = new Map(
        current.items.map((item) => [
          getOrderItemKey(item.dailyMenuItemId, item.menuItemId),
          item.status,
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
              menuItemId: line.menuItemId,
              dailyMenuItemId: line.dailyMenuItemId,
              itemNameSnapshot: line.itemNameSnapshot,
              unitPrice: money(line.unitPrice),
              quantity: line.quantity,
              status:
                existingStatuses.get(
                  getOrderItemKey(line.dailyMenuItemId, line.menuItemId)
                ) ?? line.status,
              lineTotal: money(line.lineTotal),
              note: line.note,
            })),
          },
        },
      });

      await applyStockUsage(tx, nextUsage, 1);
      updatePoolIds = Array.from(new Set([...currentUsage.keys(), ...nextUsage.keys()]));
    });

    const order = await getOrderDetail(id);
    void broadcastStockUpdate(updatePoolIds);
    return serializeOrder(order);
  }

  @Put("{orderId}/items/{itemId}/status")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async updateOrderItemStatus(
    @Path() orderId: number,
    @Path() itemId: number,
    @Body() body: UpdateOrderItemStatusBody
  ) {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUniqueOrThrow({
        where: { id: orderId },
      });

      if (!canEditOrder(order.status)) {
        throw new Error("Chi co the cap nhat mon trong don dang xu ly");
      }

      await tx.orderItem.findFirstOrThrow({
        where: {
          id: itemId,
          orderId,
        },
      });

      await tx.orderItem.update({
        where: { id: itemId },
        data: {
          status: body.status,
        },
      });
    });

    const order = await getOrderDetail(orderId);
    return serializeOrder(order);
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
