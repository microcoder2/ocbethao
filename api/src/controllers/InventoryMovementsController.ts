import {
  Controller,
  Get,
  Query,
  Route,
  Security,
  Tags,
} from "tsoa";
import { InventoryMovementType, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeInventoryMovement } from "../utils/mappers";

function parseDate(value?: string) {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

@Route("inventory-movements")
@Tags("Inventory Movements")
export class InventoryMovementsController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getInventoryMovements(
    @Query() ingredientId?: number,
    @Query() orderId?: number,
    @Query() movementType?: string,
    @Query() search?: string,
    @Query() from?: string,
    @Query() to?: string,
    @Query() limit?: number
  ) {
    const normalizedSearch = String(search || "").trim();
    const fromDate = parseDate(from);
    const toDate = parseDate(to);
    const take = Math.min(Math.max(Number(limit || 200), 1), 500);
    const normalizedMovementType = Object.values(InventoryMovementType).includes(
      movementType as InventoryMovementType
    )
      ? (movementType as InventoryMovementType)
      : undefined;

    const where: Prisma.InventoryMovementWhereInput = {
      ingredientId: ingredientId || undefined,
      orderId: orderId || undefined,
      movementType: normalizedMovementType,
      createdAt:
        fromDate || toDate
          ? {
              gte: fromDate,
              lte: toDate,
            }
          : undefined,
      OR: normalizedSearch
        ? [
            {
              note: {
                contains: normalizedSearch,
              },
            },
            {
              ingredient: {
                name: {
                  contains: normalizedSearch,
                },
              },
            },
            {
              order: {
                orderNumber: {
                  contains: normalizedSearch,
                },
              },
            },
            {
              orderItem: {
                itemNameSnapshot: {
                  contains: normalizedSearch,
                },
              },
            },
            {
              createdBy: {
                fullName: {
                  contains: normalizedSearch,
                },
              },
            },
          ]
        : undefined,
    };

    const [items, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        include: {
          ingredient: true,
          order: {
            select: {
              id: true,
              orderNumber: true,
            },
          },
          orderItem: {
            select: {
              id: true,
              menuItemId: true,
              itemNameSnapshot: true,
              quantity: true,
              note: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              fullName: true,
              role: true,
            },
          },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      total,
      limit: take,
      items: items.map(serializeInventoryMovement),
    };
  }
}
