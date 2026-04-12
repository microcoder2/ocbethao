import {
  InventoryMovementType,
  OrderItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../../src/utils/prisma";
import { formatOrderNumber } from "../../src/utils/orderNumber";
import type { SeedUserKey } from "./users";

type SeededUser = {
  id: number;
  fullName: string;
  phone: string | null;
  email?: string | null;
};

export type SeedHistoricalUsers = Record<SeedUserKey, SeededUser>;

type SeedMenuItemIngredient = {
  ingredientId: number;
  consumeQuantity: Prisma.Decimal | number;
};

type SeedMenuItemRecord = {
  id: number;
  name: string;
  currentPrice: Prisma.Decimal | number;
  ingredientPresets: SeedMenuItemIngredient[];
};

type HistoricalOrderLine = {
  menuItemId: number;
  itemNameSnapshot: string;
  unitPrice: number;
  quantity: number;
  status: OrderItemStatus;
  note: string | null;
  ingredientUsages: Array<{
    ingredientId: number;
    consumeQuantity: number;
    totalQuantity: number;
  }>;
};

type HistoricalOrderSeed = {
  createdAt: Date;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod | null;
  tableLabel: string | null;
  guestCount: number | null;
  guestName: string | null;
  guestPhone: string | null;
  note: string | null;
  internalNote: string | null;
  arrivalAt: Date | null;
  confirmedAt: Date | null;
  completedAt: Date | null;
  createdById: number;
  customerId: number | null;
  assignedStaffId: number | null;
  items: HistoricalOrderLine[];
};

type SeedIngredientConsumptionTotals = Map<number, number>;

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function startOfDay(base = new Date()): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return next;
}

function addMinutes(base: Date, minutes: number): Date {
  return new Date(base.getTime() + minutes * 60_000);
}

function withTime(base: Date, hour: number, minute: number, second: number): Date {
  const value = new Date(base);
  value.setHours(hour, minute, second, 0);
  return value;
}

function toNumber(value: Prisma.Decimal | number): number {
  return Number(value || 0);
}

function buildItemStatus(status: OrderStatus): OrderItemStatus {
  if (status === OrderStatus.CANCELLED) return OrderItemStatus.CANCELLED;
  if (status === OrderStatus.COMPLETED) return OrderItemStatus.READY;
  if (status === OrderStatus.CONFIRMED) return OrderItemStatus.COOKING;
  return OrderItemStatus.WAITING;
}

function buildItemStages(quantity: number, status: OrderStatus) {
  const itemStatus = buildItemStatus(status);

  if (itemStatus === OrderItemStatus.CANCELLED) {
    return {
      waitingQuantity: 0,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: quantity,
    };
  }

  if (itemStatus === OrderItemStatus.READY) {
    return {
      waitingQuantity: 0,
      cookingQuantity: 0,
      readyQuantity: quantity,
      cancelledQuantity: 0,
    };
  }

  if (itemStatus === OrderItemStatus.COOKING) {
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

function buildHistoricalOrderLines(
  menuItems: SeedMenuItemRecord[],
  dayIndex: number,
  orderIndex: number,
  status: OrderStatus
): HistoricalOrderLine[] {
  const lineCount = orderIndex === 1 ? 3 : 2;
  const usedMenuItemIds = new Set<number>();
  const lines: HistoricalOrderLine[] = [];
  let cursor = dayIndex * 11 + orderIndex * 7;

  while (lines.length < lineCount && usedMenuItemIds.size < menuItems.length) {
    const menuItem = menuItems[cursor % menuItems.length];
    cursor += 3;

    if (!menuItem || usedMenuItemIds.has(menuItem.id)) {
      continue;
    }

    usedMenuItemIds.add(menuItem.id);

    const quantity = 1 + ((dayIndex + orderIndex + lines.length) % 2);
    const itemStatus = buildItemStatus(status);
    const ingredientUsages = menuItem.ingredientPresets.map((preset) => {
      const consumeQuantity = toNumber(preset.consumeQuantity) || 1;
      return {
        ingredientId: preset.ingredientId,
        consumeQuantity,
        totalQuantity: Number((consumeQuantity * quantity).toFixed(2)),
      };
    });

    lines.push({
      menuItemId: menuItem.id,
      itemNameSnapshot: menuItem.name,
      unitPrice: toNumber(menuItem.currentPrice),
      quantity,
      status: itemStatus,
      note:
        orderIndex === 1 && lines.length === 0
          ? "Ưu tiên phục vụ trước"
          : orderIndex === 3 && lines.length === 0
            ? "Khách đợi order"
            : null,
      ingredientUsages,
    });
  }

  return lines;
}

function buildHistoricalOrderSeed(
  users: SeedHistoricalUsers,
  day: Date,
  dayIndex: number,
  orderIndex: number,
  menuItems: SeedMenuItemRecord[]
): HistoricalOrderSeed {
  const customerCycle = [users.lanAnh, users.quocPhuc, users.minhChau, users.anNhi];
  const staffCycle = [users.staffMai, users.staffKhanh];
  const createdAtSlots = [
    [8, 15, 10],
    [11, 30, 22],
    [15, 5, 33],
    [19, 41, 17],
  ] as const;
  const statuses = [
    OrderStatus.PENDING,
    OrderStatus.CONFIRMED,
    OrderStatus.COMPLETED,
    OrderStatus.CANCELLED,
  ] as const;
  const sources = [
    OrderSource.CUSTOMER_APP,
    OrderSource.STAFF_POS,
    OrderSource.ADMIN_POS,
    OrderSource.STAFF_POS,
  ] as const;
  const paymentStatuses = [
    PaymentStatus.UNPAID,
    PaymentStatus.UNPAID,
    PaymentStatus.PAID,
    PaymentStatus.REFUNDED,
  ] as const;
  const paymentMethods = [
    null,
    null,
    dayIndex % 2 === 0 ? PaymentMethod.CASH : PaymentMethod.TRANSFER,
    PaymentMethod.CARD,
  ] as const;

  const customer = customerCycle[(dayIndex + orderIndex) % customerCycle.length];
  const assignedStaff =
    orderIndex === 0 ? staffCycle[0] : orderIndex === 1 ? staffCycle[1] : staffCycle[dayIndex % staffCycle.length];
  const createdBy =
    orderIndex === 0 ? customer : orderIndex === 1 ? staffCycle[0] : orderIndex === 2 ? users.admin : staffCycle[1];
  const status = statuses[orderIndex];
  const source = sources[orderIndex];
  const createdAt = withTime(
    day,
    createdAtSlots[orderIndex][0],
    createdAtSlots[orderIndex][1],
    createdAtSlots[orderIndex][2]
  );
  const items = buildHistoricalOrderLines(menuItems, dayIndex, orderIndex, status);
  const customerId = customer.id;
  const guestName = customer.fullName;
  const guestPhone = customer.phone;

  return {
    createdAt,
    source,
    status,
    paymentStatus: paymentStatuses[orderIndex],
    paymentMethod: paymentMethods[orderIndex],
    tableLabel: source === OrderSource.CUSTOMER_APP ? null : `B${dayIndex + 1}${orderIndex + 1}`,
    guestCount: source === OrderSource.CUSTOMER_APP ? 2 + ((dayIndex + orderIndex) % 4) : 3 + ((dayIndex + orderIndex) % 3),
    guestName,
    guestPhone,
    note:
      orderIndex === 0
        ? "Đơn mẫu seed cho khách đi chơi"
        : orderIndex === 1
          ? "Đơn seed phục vụ buổi trưa"
          : orderIndex === 2
            ? "Đơn seed ca về"
            : "Đơn seed bị hủy",
    internalNote:
      orderIndex === 2
        ? "Đã chốt và giao món"
        : orderIndex === 3
          ? "Hủy để test luồng release"
          : "Seed dữ liệu 7 ngày",
    arrivalAt: orderIndex === 0 ? addMinutes(createdAt, 20) : orderIndex === 2 ? addMinutes(createdAt, 35) : null,
    confirmedAt:
      status === OrderStatus.PENDING
        ? null
        : status === OrderStatus.CANCELLED
          ? addMinutes(createdAt, 18)
          : addMinutes(createdAt, 6),
    completedAt: status === OrderStatus.COMPLETED ? addMinutes(createdAt, 42) : null,
    createdById: createdBy.id,
    customerId,
    assignedStaffId: assignedStaff.id,
    items,
  };
}

export async function seedHistoricalOrders(users: SeedHistoricalUsers): Promise<SeedIngredientConsumptionTotals> {
  const menuItems = (await prisma.menuItem.findMany({
    include: {
      ingredientPresets: {
        select: {
          ingredientId: true,
          consumeQuantity: true,
        },
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ id: "asc" }],
  })) as SeedMenuItemRecord[];

  const baseDay = startOfDay();
  const consumedTotals: SeedIngredientConsumptionTotals = new Map();

  for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
    const day = addDays(baseDay, -dayOffset);
    const dayIndex = 6 - dayOffset;

    for (let orderIndex = 0; orderIndex < 4; orderIndex += 1) {
      const seed = buildHistoricalOrderSeed(users, day, dayIndex, orderIndex, menuItems);

      await prisma.$transaction(async (tx) => {
        const orderNumber = formatOrderNumber(seed.createdAt);
        const subtotal = seed.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
        const serviceFee = seed.status === OrderStatus.COMPLETED ? 5000 : 0;
        const order = await tx.order.create({
          data: {
            orderNumber,
            source: seed.source,
            status: seed.status,
            paymentStatus: seed.paymentStatus,
            paymentMethod: seed.paymentMethod,
            tableLabel: seed.tableLabel,
            guestCount: seed.guestCount,
            guestName: seed.guestName,
            guestPhone: seed.guestPhone,
            note: seed.note,
            internalNote: seed.internalNote,
            arrivalAt: seed.arrivalAt,
            subtotal: money(subtotal),
            serviceFee: money(serviceFee),
            discountAmount: money(0),
            totalAmount: money(subtotal + serviceFee),
            createdById: seed.createdById,
            assignedStaffId: seed.assignedStaffId,
            customerId: seed.customerId,
            createdAt: seed.createdAt,
            confirmedAt: seed.confirmedAt,
            completedAt: seed.completedAt,
            items: {
              create: seed.items.map((item) => {
                const stages = buildItemStages(item.quantity, seed.status);
                return {
                  menuItemId: item.menuItemId,
                  itemNameSnapshot: item.itemNameSnapshot,
                  unitPrice: money(item.unitPrice),
                  quantity: item.quantity,
                  waitingQuantity: stages.waitingQuantity,
                  cookingQuantity: stages.cookingQuantity,
                  readyQuantity: stages.readyQuantity,
                  cancelledQuantity: stages.cancelledQuantity,
                  status: item.status,
                  lineTotal: money(item.unitPrice * item.quantity),
                  note: item.note,
                  createdAt: addMinutes(seed.createdAt, 1),
                };
              }),
            },
          },
          include: {
            items: {
              select: {
                id: true,
                menuItemId: true,
                itemNameSnapshot: true,
                quantity: true,
                note: true,
              },
            },
          },
        });
        const createdItems = [...order.items].sort((left, right) => left.id - right.id);

        for (let lineIndex = 0; lineIndex < seed.items.length; lineIndex += 1) {
          const item = seed.items[lineIndex];
          const orderItem = createdItems[lineIndex];
          const lineCreatedAt = addMinutes(seed.createdAt, 2 + lineIndex);

          for (let usageIndex = 0; usageIndex < item.ingredientUsages.length; usageIndex += 1) {
            const usage = item.ingredientUsages[usageIndex];
            const reserveMovement = await tx.inventoryMovement.create({
              data: {
                ingredientId: usage.ingredientId,
                orderId: order.id,
                orderItemId: orderItem.id,
                movementType: InventoryMovementType.ORDER_RESERVE,
                quantityDelta: money(-usage.totalQuantity),
                note: `Seed giữ chỗ ${order.orderNumber} - ${orderItem.itemNameSnapshot}`,
                createdById: seed.createdById,
                createdAt: lineCreatedAt,
              },
            });

            if (seed.status !== OrderStatus.CANCELLED) {
              await tx.orderItemConsumption.create({
                data: {
                  orderItemId: orderItem.id,
                  ingredientId: usage.ingredientId,
                  consumeQuantity: money(usage.consumeQuantity),
                  totalQuantity: money(usage.totalQuantity),
                  inventoryMovementId: reserveMovement.id,
                  createdAt: lineCreatedAt,
                },
              });

              consumedTotals.set(
                usage.ingredientId,
                Number(consumedTotals.get(usage.ingredientId) || 0) + usage.totalQuantity
              );
            } else {
              await tx.inventoryMovement.create({
                data: {
                  ingredientId: usage.ingredientId,
                  orderId: order.id,
                  orderItemId: orderItem.id,
                  movementType: InventoryMovementType.ORDER_RELEASE,
                  quantityDelta: money(usage.totalQuantity),
                  note: `Seed trả lại ${order.orderNumber} - ${orderItem.itemNameSnapshot}`,
                  createdById: seed.createdById,
                  createdAt: addMinutes(seed.createdAt, 15 + lineIndex),
                },
              });
            }
          }
        }
      });
    }
  }

  return consumedTotals;
}
