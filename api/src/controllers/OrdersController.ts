import {
  Body,
  Controller,
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
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeOrder } from "../utils/mappers";

class OrderItemInput {
  dailyMenuItemId?: number;
  menuItemId?: number;
  quantity!: number;
  note?: string;
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
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function buildOrderNumber(): string {
  const now = new Date();
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `OBT-${stamp}-${rand}`;
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

async function resolveOrderLine(item: OrderItemInput) {
  if (item.dailyMenuItemId) {
    const dailyMenuItem = await prisma.dailyMenuItem.findUniqueOrThrow({
      where: { id: item.dailyMenuItemId },
      include: { menuItem: true },
    });
    const unitPrice = Number(
      dailyMenuItem.overridePrice ?? dailyMenuItem.menuItem.basePrice
    );
    return {
      menuItemId: dailyMenuItem.menuItemId,
      dailyMenuItemId: dailyMenuItem.id,
      itemNameSnapshot: dailyMenuItem.menuItem.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      note: item.note,
    };
  }

  if (item.menuItemId) {
    const menuItem = await prisma.menuItem.findUniqueOrThrow({
      where: { id: item.menuItemId },
    });
    const unitPrice = Number(menuItem.basePrice);
    return {
      menuItemId: menuItem.id,
      dailyMenuItemId: null,
      itemNameSnapshot: menuItem.name,
      unitPrice,
      quantity: item.quantity,
      lineTotal: unitPrice * item.quantity,
      note: item.note,
    };
  }

  throw new Error("Each order item must include dailyMenuItemId or menuItemId");
}

@Route("orders")
@Tags("Orders")
export class OrdersController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getOrders(
    @Query() status?: OrderStatus,
    @Query() paymentStatus?: PaymentStatus,
    @Query() search?: string
  ) {
    const where: any = {};
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { orderNumber: { contains: q } },
        { guestName: { contains: q } },
        { guestPhone: { contains: q } },
        { tableLabel: { contains: q } },
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
    const lines = await Promise.all((body.items || []).map(resolveOrderLine));
    const subtotal = lines.reduce((sum, item) => sum + item.lineTotal, 0);
    const serviceFee = body.serviceFee ?? 0;
    const discountAmount = body.discountAmount ?? 0;
    const totalAmount = subtotal + serviceFee - discountAmount;

    const source =
      authUser.role === "CUSTOMER"
        ? OrderSource.CUSTOMER_APP
        : authUser.role === "STAFF"
          ? OrderSource.STAFF_POS
          : OrderSource.ADMIN_POS;

    const currentUser = await prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
    });

    const created = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          orderNumber: buildOrderNumber(),
          source,
          status: OrderStatus.PENDING,
          paymentStatus: body.paymentStatus ?? PaymentStatus.UNPAID,
          paymentMethod: body.paymentMethod,
          tableLabel: body.tableLabel,
          guestCount: body.guestCount,
          guestName:
            body.guestName ||
            (authUser.role === "CUSTOMER" ? currentUser.fullName : undefined),
          guestPhone:
            body.guestPhone ||
            (authUser.role === "CUSTOMER" ? currentUser.phone ?? undefined : undefined),
          note: body.note,
          internalNote: body.internalNote,
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

      for (const line of lines) {
        if (line.dailyMenuItemId) {
          await tx.dailyMenuItem.update({
            where: { id: line.dailyMenuItemId },
            data: { soldQuantity: { increment: line.quantity } },
          });
        }
      }

      return order.id;
    });

    const order = await getOrderDetail(created);
    this.setStatus(201);
    return serializeOrder(order);
  }

  @Put("{id}/status")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async updateOrderStatus(
    @Path() id: number,
    @Body() body: UpdateOrderStatusBody
  ) {
    const data: Prisma.OrderUpdateInput = {
      status: body.status,
      paymentStatus: body.paymentStatus,
      paymentMethod: body.paymentMethod,
      internalNote: body.internalNote,
      assignedStaff:
        typeof body.assignedStaffId === "number"
          ? { connect: { id: body.assignedStaffId } }
          : undefined,
    };

    if (body.status === OrderStatus.CONFIRMED) {
      data.confirmedAt = new Date();
    }
    if (body.status === OrderStatus.COMPLETED) {
      data.completedAt = new Date();
      if (!body.paymentStatus) {
        data.paymentStatus = PaymentStatus.PAID;
      }
    }

    await prisma.order.update({
      where: { id },
      data,
    });

    const order = await getOrderDetail(id);
    return serializeOrder(order);
  }
}
