import {
  Controller,
  Get,
  Query,
  Route,
  Security,
  Tags,
} from "tsoa";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { toNumber } from "../utils/serializers";

const GROCERY_EXPENSE_ACTION = "GROCERY_EXPENSE_RECORDED";

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
}

function getLocalDateKey(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function sumRevenue(
  orders: Array<{ totalAmount: any; paymentStatus: PaymentStatus; status: OrderStatus }>
) {
  return orders.reduce((sum, order) => {
    if (order.status === OrderStatus.CANCELLED || order.paymentStatus === PaymentStatus.REFUNDED) {
      return sum;
    }
    return sum + Number(toNumber(order.totalAmount) || 0);
  }, 0);
}

function readExpenseAmount(meta: unknown): number {
  if (!meta || typeof meta !== "object") {
    return 0;
  }

  const amount = Number((meta as { amount?: unknown }).amount || 0);
  return Number.isFinite(amount) ? amount : 0;
}

async function sumGroceryExpenses(from: Date, to?: Date): Promise<number> {
  const rows = await prisma.auditLog.findMany({
    where: {
      action: GROCERY_EXPENSE_ACTION,
      createdAt: to
        ? {
            gte: from,
            lte: to,
          }
        : {
            gte: from,
          },
    },
    select: {
      meta: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });

  const seenDays = new Set<string>();
  let total = 0;

  for (const row of rows) {
    const dayKey = getLocalDateKey(row.createdAt);
    if (seenDays.has(dayKey)) {
      continue;
    }

    seenDays.add(dayKey);
    total += readExpenseAmount(row.meta);
  }

  return total;
}

@Route("dashboard")
@Tags("Dashboard")
export class DashboardController extends Controller {
  @Get("summary")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getSummary(@Query() date?: string) {
    const focusDate = date ? new Date(date) : new Date();
    const dayStart = startOfDay(focusDate);
    const monthStart = startOfMonth(focusDate);
    const yearStart = startOfYear(focusDate);

    const [ordersDay, ordersMonth, ordersYear, allOrders, recentOrders, groceryExpenseDay, groceryExpenseMonth, groceryExpenseYear] =
      await Promise.all([
        prisma.order.findMany({
          where: { createdAt: { gte: dayStart } },
          select: { totalAmount: true, paymentStatus: true, status: true },
        }),
        prisma.order.findMany({
          where: { createdAt: { gte: monthStart } },
          select: { totalAmount: true, paymentStatus: true, status: true },
        }),
        prisma.order.findMany({
          where: { createdAt: { gte: yearStart } },
          select: { totalAmount: true, paymentStatus: true, status: true },
        }),
        prisma.order.findMany({
          include: {
            customer: {
              select: {
                customerType: true,
              },
            },
          },
        }),
        prisma.order.findMany({
          include: {
            customer: {
              select: {
                fullName: true,
                customerType: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        sumGroceryExpenses(dayStart),
        sumGroceryExpenses(monthStart),
        sumGroceryExpenses(yearStart),
      ]);

    const activeStatuses: OrderStatus[] = [OrderStatus.CONFIRMED];

    const byStatus = allOrders.reduce<Record<string, number>>((acc, order) => {
      const key = order.status;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const byCustomerType = allOrders.reduce<Record<string, number>>((acc, order) => {
      const key = order.customer?.customerType || "WALK_IN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const revenueDay = sumRevenue(ordersDay);
    const revenueMonth = sumRevenue(ordersMonth);
    const revenueYear = sumRevenue(ordersYear);

    return {
      focusDate,
      revenue: {
        day: revenueDay,
        month: revenueMonth,
        year: revenueYear,
      },
      expenses: {
        day: groceryExpenseDay,
        month: groceryExpenseMonth,
        year: groceryExpenseYear,
      },
      grossProfit: {
        day: revenueDay - groceryExpenseDay,
        month: revenueMonth - groceryExpenseMonth,
        year: revenueYear - groceryExpenseYear,
      },
      orders: {
        total: allOrders.length,
        active: allOrders.filter((order) =>
          activeStatuses.includes(order.status)
        ).length,
        completed: allOrders.filter((order) => order.status === OrderStatus.COMPLETED).length,
        cancelled: allOrders.filter((order) => order.status === OrderStatus.CANCELLED).length,
      },
      byStatus,
      byCustomerType,
      recentOrders: recentOrders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        guestName: order.guestName,
        status: order.status,
        paymentStatus: order.paymentStatus,
        totalAmount: toNumber(order.totalAmount),
        createdAt: order.createdAt,
        customerName: order.customer?.fullName ?? null,
        customerType: order.customer?.customerType ?? null,
      })),
    };
  }
}
