import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./utils/prisma";

let io: SocketIOServer | null = null;

export type OrderChangeField = "items" | "arrivalAt";
export type OrderChangeType =
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_CANCELLED"
  | "CUSTOMER_ITEM_CANCELLED"
  | "ADMIN_CONFIRMED_ORDER"
  | "ADMIN_COMPLETED_ORDER"
  | "ADMIN_CANCELLED_ORDER"
  | "ADMIN_ITEM_RESTORED"
  | "ADMIN_ITEM_COOKING"
  | "ADMIN_ITEM_READY";

export type OrderChangedPayload = {
  type: OrderChangeType;
  order: unknown;
  changedFields?: OrderChangeField[];
  itemId?: number;
  itemName?: string;
  quantity?: number;
  orderCancelled?: boolean;
  occurredAt: string;
};

type SocketTokenPayload = {
  sub?: number | string;
  role?: string;
};

type OrderChangedTarget = {
  roles?: string[];
  userIds?: number[];
};

function getRoleRoom(role: string) {
  return `role:${String(role || "").toUpperCase()}`;
}

function getUserRoom(userId: number) {
  return `user:${userId}`;
}

function emitToRooms(eventName: string, payload: unknown, rooms: string[]) {
  if (!io || !rooms.length) return;

  let emitter = io.to(rooms[0]);
  for (const room of rooms.slice(1)) {
    emitter = emitter.to(room);
  }
  emitter.emit(eventName, payload);
}

export function initSocket(
  httpServer: HttpServer,
  corsOriginFn: (
    origin: string | undefined,
    cb: (err: Error | null, allow?: boolean) => void,
  ) => void,
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: corsOriginFn,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    const token = String(socket.handshake.auth?.token || "").trim();
    const secret = process.env.JWT_SECRET;

    if (!token || !secret) {
      next(new Error("Unauthorized"));
      return;
    }

    try {
      const decoded = jwt.verify(token, secret) as SocketTokenPayload;
      const userId = Number(decoded.sub);
      const role = String(decoded.role || "").toUpperCase();

      if (!Number.isFinite(userId) || !role) {
        next(new Error("Unauthorized"));
        return;
      }

      socket.data.authUser = {
        id: userId,
        role,
      };
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const authUser = socket.data.authUser as { id?: number; role?: string } | undefined;
    if (!authUser?.id || !authUser.role) {
      socket.disconnect();
      return;
    }

    socket.join(getUserRoom(authUser.id));
    socket.join(getRoleRoom(authUser.role));
  });

  return io;
}

export function getIo(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast a newly created order to all connected clients.
 */
export function broadcastNewOrder(order: unknown): void {
  emitToRooms("order:new", order, [getRoleRoom("ADMIN"), getRoleRoom("STAFF")]);
}

export function broadcastOrderChanged(
  payload: OrderChangedPayload,
  target: OrderChangedTarget = {}
): void {
  const rooms = [
    ...new Set([
      ...(target.roles || []).map(getRoleRoom),
      ...(target.userIds || [])
        .filter((userId) => Number.isFinite(userId) && userId > 0)
        .map(getUserRoom),
    ]),
  ];

  emitToRooms("order:changed", payload, rooms);
}

/**
 * Fetch fresh pool data after a stock change and broadcast to all clients.
 */
export async function broadcastStockUpdate(poolIds: number[]): Promise<void> {
  if (!poolIds.length || !io) return;

  const pools = await prisma.dailyStockPool.findMany({
    where: { id: { in: poolIds } },
    include: { ingredient: true },
  });

  io.emit(
    "stock:update",
    pools.map((pool) => ({
      id: pool.id,
      label: pool.label ?? pool.ingredient?.name ?? null,
      remainingQuantity: Math.max(
        Number(pool.quantity) - Number(pool.soldQuantity),
        0,
      ),
      isAvailable: pool.isAvailable,
    })),
  );
}
