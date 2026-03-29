import type { Server as HttpServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { prisma } from "./utils/prisma";

let io: SocketIOServer | null = null;

export function initSocket(
  httpServer: HttpServer,
  corsOriginFn: (origin: string, cb: (err: Error | null, allow?: boolean) => void) => void
): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: corsOriginFn,
      credentials: true,
    },
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
  if (!io) return;
  io.emit("order:new", order);
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
      remainingQuantity: Math.max(Number(pool.quantity) - Number(pool.soldQuantity), 0),
      isAvailable: pool.isAvailable,
    }))
  );
}
