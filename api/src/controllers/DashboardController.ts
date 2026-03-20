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

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date: Date): Date {
  return new Date(date.getFullYear(), 0, 1);
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

    const [ordersDay, ordersMonth, ordersYear, allOrders, recentOrders] =
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
      ]);

    const activeStatuses: OrderStatus[] = [
      OrderStatus.PENDING,
      OrderStatus.CONFIRMED,
      OrderStatus.PREPARING,
      OrderStatus.READY,
      OrderStatus.SERVED,
    ];

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

    return {
      focusDate,
      revenue: {
        day: sumRevenue(ordersDay),
        month: sumRevenue(ordersMonth),
        year: sumRevenue(ordersYear),
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
