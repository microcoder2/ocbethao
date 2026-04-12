import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import { InventoryMovementType, Prisma } from "@prisma/client";
import type { Request as ExRequest } from "express";
import { prisma } from "../utils/prisma";
import { serializeIngredientStock, serializeInventoryMovement } from "../utils/mappers";
import {
  captureInventoryOpeningSnapshot,
  getInventoryOpeningSnapshot,
  getInventoryOpeningSnapshotItem,
  type InventoryOpeningSnapshot,
  type InventoryOpeningSnapshotCaptureResult,
} from "../services/inventoryOpeningSnapshotService";

function parseDate(value?: string, mode: "start" | "end" = "start") {
  if (!value) return undefined;
  const normalized = String(value).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? new Date(
        `${normalized}T${mode === "start" ? "00:00:00" : "23:59:59.999"}`
      )
    : new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

type InventoryMovementFilters = {
  ingredientId?: number;
  orderId?: number;
  movementType?: string;
  search?: string;
  from?: string;
  to?: string;
};

type LossReportDayRow = {
  day: string;
  label: string;
  movementCount: number;
  lossQuantity: number;
};

type LossReportIngredientRow = {
  ingredientId: number;
  ingredientName: string;
  unit: string | null;
  movementCount: number;
  lossQuantity: number;
};

type IngredientSummaryStockRow = {
  quantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  updatedAt: string;
};

type IngredientOpeningSnapshotRow = {
  day: string;
  capturedAt: string | null;
  totalRemainingQuantity: number | null;
  remainingQuantity: number;
  source: "audit-log" | "derived";
};

type IngredientMovementSummaryResponse = {
  ingredient: {
    id: number;
    name: string;
    unit: string | null;
    isActive: boolean;
  };
  currentStock: IngredientSummaryStockRow | null;
  openingSnapshot: IngredientOpeningSnapshotRow | null;
  range: {
    from: string;
    to: string;
  };
  movementCount: number;
  totalIncrease: number;
  totalDecrease: number;
  netChange: number;
  expectedClosingQuantity: number;
  discrepancy: number;
};

type InventoryOpeningSnapshotCaptureResponse = InventoryOpeningSnapshotCaptureResult;

type InventoryOpeningSnapshotLookupResponse = {
  snapshot: InventoryOpeningSnapshot | null;
};

class CaptureOpeningSnapshotBody {
  force?: boolean;
}

function buildLossMovementFilter(): Prisma.InventoryMovementWhereInput {
  return {
    OR: [
      {
        AND: [
          {
            movementType: InventoryMovementType.MENU_POOL_DECREASE,
          },
          {
            quantityDelta: {
              lt: 0,
            },
          },
        ],
      },
      {
        AND: [
          {
            movementType: InventoryMovementType.MANUAL_ADJUST,
          },
          {
            quantityDelta: {
              lt: 0,
            },
          },
        ],
      },
      {
        AND: [
          {
            movementType: InventoryMovementType.CORRECTION,
          },
          {
            quantityDelta: {
              lt: 0,
            },
          },
        ],
      },
    ],
  };
}

function buildInventoryMovementWhere({
  ingredientId,
  orderId,
  movementType,
  search,
  from,
  to,
}: InventoryMovementFilters): Prisma.InventoryMovementWhereInput {
  const normalizedSearch = String(search || "").trim();
  const fromDate = parseDate(from, "start");
  const toDate = parseDate(to, "end");
  const requestedMovementType = String(movementType || "").trim().toUpperCase();
  const filters: Prisma.InventoryMovementWhereInput[] = [];

  if (ingredientId) {
    filters.push({ ingredientId });
  }

  if (orderId) {
    filters.push({ orderId });
  }

  if (requestedMovementType === "LOSS") {
    filters.push(buildLossMovementFilter());
  } else if (
    Object.values(InventoryMovementType).includes(
      requestedMovementType as InventoryMovementType
    )
  ) {
    filters.push({
      movementType: requestedMovementType as InventoryMovementType,
    });
  }

  if (fromDate || toDate) {
    const createdAt: Prisma.DateTimeFilter = {};
    if (fromDate) {
      createdAt.gte = fromDate;
    }
    if (toDate) {
      createdAt.lte = toDate;
    }
    filters.push({ createdAt });
  }

  if (normalizedSearch) {
    filters.push({
      OR: [
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
      ],
    });
  }

  return filters.length > 0 ? { AND: filters } : {};
}

function toLossQuantity(value: unknown) {
  return Math.abs(Number(value || 0));
}

function getLocalDateKey(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(23, 59, 59, 999);
  return value;
}

function formatDateLabel(dayKey: string) {
  const [year, month, day] = dayKey.split("-");
  if (!year || !month || !day) return dayKey;
  return `${day}/${month}/${year}`;
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
    @Query() page?: number,
    @Query() pageSize?: number
  ) {
    const currentPage = Math.max(Number(page || 1), 1);
    const currentPageSize = Math.min(Math.max(Number(pageSize || 50), 10), 200);
    const skip = (currentPage - 1) * currentPageSize;
    const take = currentPageSize;
    const where = buildInventoryMovementWhere({
      ingredientId,
      orderId,
      movementType,
      search,
      from,
      to,
    });

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
        skip,
        take,
      }),
      prisma.inventoryMovement.count({ where }),
    ]);

    return {
      total,
      page: currentPage,
      pageSize: currentPageSize,
      items: items.map(serializeInventoryMovement),
    };
  }

  @Get("/summary")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getInventoryMovementSummary(
    @Query() ingredientId?: number,
    @Query() from?: string,
    @Query() to?: string
  ): Promise<IngredientMovementSummaryResponse> {
    const normalizedIngredientId = Number(ingredientId || 0);
    if (!normalizedIngredientId) {
      this.setStatus(400);
      throw new Error("Missing ingredientId");
    }

    const summaryDay = parseDate(from, "start") ?? parseDate(to, "start") ?? new Date();

    const [ingredient, stock, movements, openingSnapshot] = await Promise.all([
      prisma.ingredient.findUnique({
        where: { id: normalizedIngredientId },
        select: {
          id: true,
          name: true,
          unit: true,
          isActive: true,
        },
      }),
      prisma.ingredientStock.findUnique({
        where: { ingredientId: normalizedIngredientId },
        include: {
          ingredient: true,
        },
      }),
      (() => {
        const fromDate = parseDate(from, "start") ?? startOfLocalDay(summaryDay);
        const toDate = parseDate(to, "end") ?? endOfLocalDay(summaryDay);
        return prisma.inventoryMovement.findMany({
          where: {
            ingredientId: normalizedIngredientId,
            createdAt: {
              gte: fromDate,
              lte: toDate,
            },
          },
          select: {
            quantityDelta: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        });
      })(),
      getInventoryOpeningSnapshot(summaryDay),
    ]);

    if (!ingredient) {
      this.setStatus(404);
      throw new Error("Ingredient not found");
    }

    const currentStock = stock ? serializeIngredientStock(stock) : null;
    let totalIncrease = 0;
    let totalDecrease = 0;
    let netChange = 0;

    for (const movement of movements) {
      const delta = Number(movement.quantityDelta || 0);
      netChange += delta;
      if (delta > 0) {
        totalIncrease += delta;
      } else if (delta < 0) {
        totalDecrease += Math.abs(delta);
      }
    }

    const currentQuantity = Number(currentStock?.remainingQuantity || 0);
    const openingItem = getInventoryOpeningSnapshotItem(openingSnapshot, normalizedIngredientId);
    const hasAuditSnapshot = Boolean(openingItem);
    const openingQuantity = hasAuditSnapshot
      ? Number(openingItem?.remainingQuantity || 0)
      : Math.max(currentQuantity - netChange, 0);
    const expectedClosingQuantity = openingQuantity + netChange;
    const discrepancy = currentQuantity - expectedClosingQuantity;

    return {
      ingredient,
      currentStock: currentStock
        ? {
            quantity: currentStock.quantity,
            soldQuantity: currentStock.soldQuantity,
            remainingQuantity: currentStock.remainingQuantity,
            updatedAt: currentStock.updatedAt.toString(),
          }
        : null,
      openingSnapshot: {
        day: getLocalDateKey(summaryDay),
        capturedAt: openingSnapshot?.capturedAt ?? null,
        totalRemainingQuantity: openingSnapshot?.totalRemainingQuantity ?? null,
        remainingQuantity: openingQuantity,
        source: hasAuditSnapshot ? "audit-log" : "derived",
      },
      range: {
        from: (parseDate(from, "start") ?? startOfLocalDay(summaryDay)).toISOString(),
        to: (parseDate(to, "end") ?? endOfLocalDay(summaryDay)).toISOString(),
      },
      movementCount: movements.length,
      totalIncrease,
      totalDecrease,
      netChange,
      expectedClosingQuantity,
      discrepancy,
    };
  }

  @Get("/opening-snapshot")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getOpeningSnapshot(): Promise<InventoryOpeningSnapshotLookupResponse> {
    const snapshot = await getInventoryOpeningSnapshot(new Date());
    return { snapshot };
  }

  @Post("/opening-snapshot")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async captureOpeningSnapshot(
    @Request() req: ExRequest,
    @Body() body?: CaptureOpeningSnapshotBody
  ): Promise<InventoryOpeningSnapshotCaptureResponse> {
    const authUser = (req as any).user;
    const result = await captureInventoryOpeningSnapshot(new Date(), {
      userId: authUser?.id ?? null,
      ip: req.ip ?? null,
      userAgent: typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : null,
    }, {
      force: Boolean(body?.force),
    });

    this.setStatus(result.created ? 201 : 200);
    return result;
  }

  @Get("/loss-report")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getLossReport(
    @Query() search?: string,
    @Query() from?: string,
    @Query() to?: string
  ) {
    const where = buildInventoryMovementWhere({
      movementType: "LOSS",
      search,
      from,
      to,
    });

    const rows = await prisma.inventoryMovement.findMany({
      where,
      select: {
        ingredientId: true,
        quantityDelta: true,
        createdAt: true,
        ingredient: {
          select: {
            id: true,
            name: true,
            unit: true,
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });

    const dayMap = new Map<string, LossReportDayRow>();
    const ingredientMap = new Map<number, LossReportIngredientRow>();
    let totalLoss = 0;
    let totalCount = 0;

    for (const row of rows) {
      const lossQuantity = toLossQuantity(row.quantityDelta);
      if (lossQuantity <= 0) {
        continue;
      }

      totalLoss += lossQuantity;
      totalCount += 1;

      const dayKey = getLocalDateKey(row.createdAt);
      const dayEntry = dayMap.get(dayKey) || {
        day: dayKey,
        label: formatDateLabel(dayKey),
        movementCount: 0,
        lossQuantity: 0,
      };
      dayEntry.movementCount += 1;
      dayEntry.lossQuantity += lossQuantity;
      dayMap.set(dayKey, dayEntry);

      const ingredientEntry = ingredientMap.get(row.ingredientId) || {
        ingredientId: row.ingredient?.id ?? row.ingredientId,
        ingredientName: row.ingredient?.name || "Nguyên liệu",
        unit: row.ingredient?.unit ?? null,
        movementCount: 0,
        lossQuantity: 0,
      };
      ingredientEntry.movementCount += 1;
      ingredientEntry.lossQuantity += lossQuantity;
      ingredientMap.set(ingredientEntry.ingredientId, ingredientEntry);
    }

    const byDay = Array.from(dayMap.values()).sort((a, b) =>
      b.day.localeCompare(a.day)
    );
    const byIngredient = Array.from(ingredientMap.values()).sort((a, b) => {
      const lossDiff = b.lossQuantity - a.lossQuantity;
      if (lossDiff !== 0) return lossDiff;
      const countDiff = b.movementCount - a.movementCount;
      if (countDiff !== 0) return countDiff;
      return a.ingredientName.localeCompare(b.ingredientName, "vi");
    });

    return {
      totalLoss,
      totalCount,
      dayCount: byDay.length,
      ingredientCount: byIngredient.length,
      byDay,
      byIngredient,
    };
  }
}
