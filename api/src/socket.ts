import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./utils/prisma";

let io: SocketIOServer | null = null;

export type OrderChangeField = "items" | "arrivalAt";
export type OrderChangeType =
  | "CUSTOMER_UPDATED"
  | "CUSTOMER_CANCELLED"
  | "CUSTOMER_ITEM_CANCELLED";

export type OrderChangedPayload = {
  type: OrderChangeType;
  order: unknown;
  changedFields?: OrderChangeField[];
  itemId?: number;
  itemName?: string;
  orderCancelled?: boolean;
  occurredAt: string;
};

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

  // io.on('connection', (socket) => {
  //   console.log('a user connected');

  //   socket.on('disconnect', () => {
  //     console.log('user disconnected');
  //   });

  //   socket.on('chat:send_message', (msg) => {
  //     socket.broadcast.emit('chat:receive_message', msg);
  //   });
  // });

  return io;
}

export function getIo(): SocketIOServer | null {
  return io;
}

/**
 * Broadcast a newly created order to all connected clients.
 */
export function broadcastNewOrder(order: unknown): void {
  if (!io) return;
  io.emit("order:new", order);
}

export function broadcastOrderChanged(payload: OrderChangedPayload): void {
  if (!io) return;
  io.emit("order:changed", payload);
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
