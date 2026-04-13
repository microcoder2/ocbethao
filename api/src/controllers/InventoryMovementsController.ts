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

const GROCERY_EXPENSE_ACTION = "GROCERY_EXPENSE_RECORDED";

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

type GroceryExpenseResponse = {
  id: number;
  amount: number;
  note: string | null;
  recordedAt: string;
  recordedDate: string;
  breakdown: GroceryExpenseBreakdownItem[];
};

type GroceryExpenseLookupResponse = {
  expense: GroceryExpenseResponse | null;
};

type GroceryExpenseBreakdownItem = {
  ingredientId: number;
  ingredientName: string | null;
  unit: string | null;
  remainingQuantity: number;
  amount: number;
  note: string | null;
};

class CaptureOpeningSnapshotBody {
  force?: boolean;
}

class GroceryExpenseBreakdownBody {
  ingredientId!: number;
  ingredientName?: string;
  unit?: string;
  remainingQuantity?: number;
  amount!: number;
  note?: string;
}

class RecordGroceryExpenseBody {
  amount!: number;
  note?: string;
  date?: string;
  breakdown?: GroceryExpenseBreakdownBody[];
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

function normalizeCurrencyAmount(value: unknown) {
  return Math.round(Number(value || 0));
}

function getLocalDateKey(value: Date) {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDateInput(value?: string) {
  if (!value) {
    return null;
  }

  const normalized = String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const [year, month, day] = normalized.split("-").map((part) => Number(part));
  if (!year || !month || !day) {
    return null;
  }

  const parsed = new Date(year, month - 1, day, 12, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
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

function getGroceryExpenseWhere(day: Date): Prisma.AuditLogWhereInput {
  return {
    action: GROCERY_EXPENSE_ACTION,
    createdAt: {
      gte: startOfLocalDay(day),
      lte: endOfLocalDay(day),
    },
  };
}

function toGroceryExpenseResponse(record: {
  id: number;
  createdAt: Date;
  meta: Prisma.JsonValue | null;
}): GroceryExpenseResponse | null {
  if (!record.meta || typeof record.meta !== "object" || Array.isArray(record.meta)) {
    return null;
  }

  const meta = record.meta as {
    amount?: unknown;
    note?: unknown;
    breakdown?: unknown;
  };

  const breakdown = Array.isArray(meta.breakdown)
    ? meta.breakdown
        .map((item) => ({
          ingredientId: Number((item as { ingredientId?: unknown })?.ingredientId || 0),
          ingredientName:
            String((item as { ingredientName?: unknown })?.ingredientName || "").trim() || null,
          unit: String((item as { unit?: unknown })?.unit || "").trim() || null,
          remainingQuantity: Number((item as { remainingQuantity?: unknown })?.remainingQuantity || 0),
          amount: normalizeCurrencyAmount((item as { amount?: unknown })?.amount),
          note: String((item as { note?: unknown })?.note || "").trim() || null,
        }))
        .filter((item) => item.ingredientId > 0 && item.amount > 0)
    : [];
  const breakdownAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
  const amount = breakdownAmount > 0 ? breakdownAmount : normalizeCurrencyAmount(meta.amount);

  return {
    id: record.id,
    amount,
    note: String(meta.note || "").trim() || null,
    recordedAt: record.createdAt.toISOString(),
    recordedDate: getLocalDateKey(record.createdAt),
    breakdown,
  };
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

  @Get("/grocery-expense")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getGroceryExpense(
    @Query() date?: string
  ): Promise<GroceryExpenseLookupResponse> {
    const requestedDate = parseDateInput(date) ?? new Date();
    const record = await prisma.auditLog.findFirst({
      where: getGroceryExpenseWhere(requestedDate),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        createdAt: true,
        meta: true,
      },
    });

    return {
      expense: record ? toGroceryExpenseResponse(record) : null,
    };
  }

  @Post("/grocery-expense")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async recordGroceryExpense(
    @Request() req: ExRequest,
    @Body() body: RecordGroceryExpenseBody
  ): Promise<GroceryExpenseResponse | { message: string }> {
    const authUser = (req as any).user;
    const requestedDate = parseDateInput(body?.date) ?? new Date();
    const note = String(body?.note || "").trim() || null;
    const breakdown = Array.isArray(body?.breakdown)
      ? body.breakdown
          .map((item) => ({
            ingredientId: Number(item?.ingredientId || 0),
            ingredientName: String(item?.ingredientName || "").trim() || null,
            unit: String(item?.unit || "").trim() || null,
            remainingQuantity: Number(item?.remainingQuantity || 0),
            amount: normalizeCurrencyAmount(item?.amount),
            note: String(item?.note || "").trim() || null,
          }))
          .filter((item) => item.ingredientId > 0 && item.amount > 0)
      : [];
    const breakdownAmount = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const amount = breakdownAmount > 0 ? breakdownAmount : normalizeCurrencyAmount(body?.amount);
    const records = await prisma.auditLog.findMany({
      where: getGroceryExpenseWhere(requestedDate),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        createdAt: true,
      },
    });

    if (!Number.isFinite(amount) || amount < 0) {
      this.setStatus(400);
      return { message: "Số tiền chợ phải lớn hơn hoặc bằng 0" };
    }

    if (amount <= 0) {
      if (!records.length) {
        this.setStatus(400);
        return { message: "Số tiền chợ phải lớn hơn 0" };
      }

      await prisma.auditLog.deleteMany({
        where: {
          id: {
            in: records.map((record) => record.id),
          },
        },
      });

      this.setStatus(200);
      return {
        id: records[0].id,
        amount: 0,
        note: null,
        recordedAt: requestedDate.toISOString(),
        recordedDate: getLocalDateKey(requestedDate),
        breakdown: [],
      };
    }

    const persistedMeta = {
      amount,
      note,
      source: "grocery-expense-page",
      recordedDate: getLocalDateKey(requestedDate),
      breakdown,
    } as Prisma.InputJsonValue;

    const record = records.length
      ? await prisma.auditLog.update({
          where: {
            id: records[0].id,
          },
          data: {
            userId: authUser?.id ?? null,
            ip: req.ip ?? null,
            userAgent:
              typeof req.headers["user-agent"] === "string"
                ? req.headers["user-agent"]
                : null,
            action: GROCERY_EXPENSE_ACTION,
            createdAt: requestedDate,
            meta: persistedMeta,
          },
          select: {
            id: true,
            createdAt: true,
          },
        })
      : await prisma.auditLog.create({
          data: {
            userId: authUser?.id ?? null,
            ip: req.ip ?? null,
            userAgent:
              typeof req.headers["user-agent"] === "string"
                ? req.headers["user-agent"]
                : null,
            action: GROCERY_EXPENSE_ACTION,
            createdAt: requestedDate,
            meta: persistedMeta,
          },
          select: {
            id: true,
            createdAt: true,
          },
        });

    if (records.length > 1) {
      await prisma.auditLog.deleteMany({
        where: {
          id: {
            in: records.slice(1).map((record) => record.id),
          },
        },
      });
    }

    this.setStatus(records.length ? 200 : 201);
    return {
      id: record.id,
      amount,
      note,
      recordedAt: record.createdAt.toISOString(),
      recordedDate: getLocalDateKey(record.createdAt),
      breakdown,
    };
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
