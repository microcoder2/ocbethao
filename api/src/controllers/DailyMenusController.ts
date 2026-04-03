import {
  Body,
  Controller,
  Delete,
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
import { DailyMenuStatus, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import {
  serializeDailyMenu,
  serializeDailyMenuSummary,
  serializeDailyMenuWorkspace,
} from "../utils/mappers";
import {
  buildDefaultOffer,
  buildMergedDailyMenu,
  catalogMenuItemInclude,
  dailyMenuResourceInclude,
  loadCatalogMenuItems,
  normalizeDailyMenuText,
  normalizeStockLinkSignature,
} from "../services/dailyMenuOfferService";

class DailyMenuStockPoolInput {
  id?: number;
  key?: string;
  ingredientId!: number;
  label?: string;
  quantity!: number;
  isAvailable?: boolean;
  note?: string;
}

class DailyMenuItemStockLinkInput {
  dailyStockPoolId?: number;
  stockPoolKey?: string;
  consumeQuantity?: number;
}

class DailyMenuItemInput {
  id?: number;
  menuItemId!: number;
  overridePrice?: number;
  isAvailable?: boolean;
  highlightLabel?: string;
  stockLinks!: DailyMenuItemStockLinkInput[];
}

class DailyMenuBody {
  code?: string;
  title!: string;
  serviceDate!: string;
  status?: DailyMenuStatus;
  note?: string;
  bannerText?: string;
  stockPools!: DailyMenuStockPoolInput[];
  items!: DailyMenuItemInput[];
}

function toMoney(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function buildMenuCode(serviceDate: string): string {
  return `MENU-${serviceDate}`;
}

function getLocalDateInputValue(base = new Date()) {
  const local = new Date(base.getTime() - base.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseDateOnly(value: string, fieldName = "Ngay") {
  const normalized = String(value || "").trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`${fieldName} khong hop le`);
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} khong hop le`);
  }

  return parsed;
}

function getRemainingQuantity(pool: { quantity: number | Prisma.Decimal; soldQuantity: number | Prisma.Decimal }) {
  return Math.max(Number(pool.quantity) - Number(pool.soldQuantity), 0);
}

async function getDailyMenuById(id: number) {
  return prisma.dailyMenu.findUniqueOrThrow({
    where: { id },
    include: dailyMenuResourceInclude,
  });
}

async function getDailyMenuByCode(code: string, status?: DailyMenuStatus) {
  return prisma.dailyMenu.findFirst({
    where: {
      code,
      ...(status ? { status } : {}),
    },
    include: dailyMenuResourceInclude,
  });
}

async function getMergedDailyMenuById(id: number, includeUnavailableItems = true) {
  const menu = await getDailyMenuById(id);
  const catalogItems = await loadCatalogMenuItems(prisma);
  return buildMergedDailyMenu(menu, catalogItems, {
    includeUnavailableItems,
  });
}

async function getMergedDailyMenusByDate(date: string) {
  const menus = await prisma.dailyMenu.findMany({
    where: { code: buildMenuCode(date) },
    include: dailyMenuResourceInclude,
    orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
  });
  const catalogItems = await loadCatalogMenuItems(prisma);
  return menus.map((menu) =>
    buildMergedDailyMenu(menu, catalogItems, {
      includeUnavailableItems: true,
    })
  );
}

async function getStockBaselineForDate(date: string) {
  const targetCode = buildMenuCode(date);
  const previousMenu = await prisma.dailyMenu.findFirst({
    where: {
      code: { lt: targetCode },
    },
    include: {
      stockPools: {
        include: {
          ingredient: true,
        },
        orderBy: { id: "asc" },
      },
    },
    orderBy: [{ code: "desc" }, { createdAt: "desc" }],
  });

  if (!previousMenu) {
    return [];
  }

  return previousMenu.stockPools.map((pool) => ({
    ingredientId: pool.ingredientId,
    label: pool.label ?? pool.ingredient?.name ?? null,
    quantity: getRemainingQuantity(pool),
    isAvailable: Boolean(pool.isAvailable),
    note: pool.note ?? null,
    sourceMenuId: previousMenu.id,
    sourceServiceDate: previousMenu.serviceDate,
  }));
}

function normalizeStockPools(inputs: DailyMenuStockPoolInput[]) {
  return (inputs || [])
    .filter(
      (pool) =>
        pool &&
        typeof pool.ingredientId === "number" &&
        typeof pool.quantity === "number" &&
        pool.quantity >= 0
    )
    .map((pool) => ({
      id: pool.id,
      key: pool.key,
      ingredientId: pool.ingredientId,
      label: pool.label?.trim() || undefined,
      quantity: pool.quantity,
      isAvailable: pool.isAvailable ?? true,
      note: pool.note?.trim() || undefined,
    }));
}

function normalizeItems(inputs: DailyMenuItemInput[]) {
  return (inputs || [])
    .filter((item) => item && typeof item.menuItemId === "number")
    .map((item) => ({
      id: item.id,
      menuItemId: item.menuItemId,
      overridePrice: typeof item.overridePrice === "number" ? item.overridePrice : undefined,
      isAvailable: item.isAvailable ?? true,
      highlightLabel: item.highlightLabel?.trim() || undefined,
      stockLinks: (item.stockLinks || [])
        .filter(
          (link) =>
            Boolean(
              typeof link.dailyStockPoolId === "number" ||
                String(link.stockPoolKey || "").trim()
            )
        )
        .map((link) => ({
          dailyStockPoolId: link.dailyStockPoolId,
          stockPoolKey: link.stockPoolKey?.trim() || undefined,
          consumeQuantity:
            typeof link.consumeQuantity === "number" && link.consumeQuantity > 0
              ? link.consumeQuantity
              : 1,
        })),
    }));
}

function filterMeaningfulStockPools(
  stockPools: ReturnType<typeof normalizeStockPools>,
  items: ReturnType<typeof normalizeItems>
) {
  const referencedPoolIds = new Set<number>();
  const referencedPoolKeys = new Set<string>();

  for (const item of items) {
    for (const link of item.stockLinks) {
      if (typeof link.dailyStockPoolId === "number") {
        referencedPoolIds.add(link.dailyStockPoolId);
      }
      if (link.stockPoolKey) {
        referencedPoolKeys.add(link.stockPoolKey);
      }
    }
  }

  return stockPools.filter((pool) => {
    if (pool.isAvailable) {
      return true;
    }
    if (pool.quantity > 0) {
      return true;
    }
    if (typeof pool.id === "number" && referencedPoolIds.has(pool.id)) {
      return true;
    }
    if (pool.key && referencedPoolKeys.has(pool.key)) {
      return true;
    }
    return false;
  });
}

async function syncDailyMenuResources(
  tx: Prisma.TransactionClient,
  dailyMenuId: number,
  body: DailyMenuBody
): Promise<void> {
  const items = normalizeItems(body.items);
  const stockPools = filterMeaningfulStockPools(normalizeStockPools(body.stockPools), items);
  const ingredientIds = Array.from(new Set(stockPools.map((pool) => pool.ingredientId)));

  const [ingredients, existingPools, existingItems, catalogItems] = await Promise.all([
    ingredientIds.length
      ? tx.ingredient.findMany({ where: { id: { in: ingredientIds } } })
      : Promise.resolve([]),
    tx.dailyStockPool.findMany({
      where: { dailyMenuId },
      include: {
        _count: {
          select: {
            itemLinks: true,
          },
        },
      },
    }),
    tx.dailyMenuItem.findMany({
      where: { dailyMenuId },
      include: {
        stockLinks: {
          orderBy: { id: "asc" as const },
        },
        _count: {
          select: {
            orderItems: true,
          },
        },
      },
    }),
    loadCatalogMenuItems(tx),
  ]);

  const ingredientMap = new Map(ingredients.map((ingredient) => [ingredient.id, ingredient]));
  const poolRefs = new Map<string, number>();
  const keptPoolIds: number[] = [];

  for (const pool of stockPools) {
    const ingredient = ingredientMap.get(pool.ingredientId);
    if (!ingredient) {
      throw new Error(`Ingredient ${pool.ingredientId} not found`);
    }

    const existingPool = typeof pool.id === "number"
      ? existingPools.find((candidate) => candidate.id === pool.id)
      : undefined;

    if (existingPool) {
      if (
        Number(existingPool.soldQuantity) > 0 &&
        existingPool.ingredientId !== pool.ingredientId
      ) {
        throw new Error("Khong the doi nguon hang da co phat sinh don");
      }
      if (pool.quantity < Number(existingPool.soldQuantity)) {
        throw new Error("So luong pool khong du lon hon phan da ban");
      }

      const updated = await tx.dailyStockPool.update({
        where: { id: existingPool.id },
        data: {
          ingredientId: pool.ingredientId,
          label: pool.label || ingredient.name,
          quantity: toMoney(pool.quantity),
          isAvailable: pool.isAvailable,
          note: pool.note,
        },
      });
      keptPoolIds.push(updated.id);
      poolRefs.set(`id:${updated.id}`, updated.id);
      if (pool.key) {
        poolRefs.set(`key:${pool.key}`, updated.id);
      }
      continue;
    }

    const created = await tx.dailyStockPool.create({
      data: {
        dailyMenuId,
        ingredientId: pool.ingredientId,
        label: pool.label || ingredient.name,
        quantity: toMoney(pool.quantity),
        isAvailable: pool.isAvailable,
        note: pool.note,
      },
    });
    keptPoolIds.push(created.id);
    poolRefs.set(`id:${created.id}`, created.id);
    if (pool.key) {
      poolRefs.set(`key:${pool.key}`, created.id);
    }
  }

  for (const pool of existingPools) {
    if (keptPoolIds.includes(pool.id)) {
      poolRefs.set(`id:${pool.id}`, pool.id);
      continue;
    }

    if (Number(pool.soldQuantity) > 0 || pool._count.itemLinks > 0) {
      await tx.dailyStockPool.update({
        where: { id: pool.id },
        data: { isAvailable: false },
      });
      poolRefs.set(`id:${pool.id}`, pool.id);
      continue;
    }

    await tx.dailyStockPool.delete({
      where: { id: pool.id },
    });
  }

  const savedPools = await tx.dailyStockPool.findMany({
    where: { dailyMenuId },
    include: {
      ingredient: true,
    },
    orderBy: { id: "asc" },
  });

  const catalogById = new Map(catalogItems.map((item) => [item.id, item]));
  const existingItemsByMenuItemId = new Map(
    existingItems.map((item) => [item.menuItemId, item])
  );
  const submittedItemsByMenuItemId = new Map<
    number,
    {
      overridePrice: number | undefined;
      highlightLabel: string | null;
      stockLinks: Array<{ dailyStockPoolId: number; consumeQuantity: number }>;
    }
  >();

  for (const item of items) {
    const catalogItem = catalogById.get(item.menuItemId);
    if (!catalogItem) {
      throw new Error(`Mon ${item.menuItemId} khong ton tai trong ngan hang mon`);
    }

    if (item.stockLinks.length === 0) {
      throw new Error("Moi mon trong menu ngay phai gan it nhat mot pool nguon hang");
    }

    const resolvedStockLinks = item.stockLinks.map((link) => {
      const resolvedId =
        typeof link.dailyStockPoolId === "number"
          ? poolRefs.get(`id:${link.dailyStockPoolId}`) || link.dailyStockPoolId
          : poolRefs.get(`key:${link.stockPoolKey}`);

      if (!resolvedId) {
        throw new Error("Khong tim thay pool nguon hang da chon");
      }

      return {
        dailyStockPoolId: resolvedId,
        consumeQuantity: link.consumeQuantity,
      };
    });

    submittedItemsByMenuItemId.set(item.menuItemId, {
      overridePrice: item.overridePrice,
      highlightLabel: normalizeDailyMenuText(item.highlightLabel),
      stockLinks: resolvedStockLinks,
    });
  }

  const processedMenuItemIds = new Set<number>();

  for (const catalogItem of catalogItems) {
    processedMenuItemIds.add(catalogItem.id);
    const defaults = buildDefaultOffer(catalogItem, savedPools);
    const existingItem = existingItemsByMenuItemId.get(catalogItem.id);
    const submittedItem = submittedItemsByMenuItemId.get(catalogItem.id);
    const hasOrders = Number(existingItem?._count.orderItems || 0) > 0;
    const defaultPrice = defaults.defaultPrice;
    const defaultHighlight = normalizeDailyMenuText(defaults.defaultHighlightLabel);
    const defaultLinks = defaults.stockLinks.map((link) => ({
      dailyStockPoolId: link.dailyStockPoolId,
      consumeQuantity: link.consumeQuantity,
    }));
    const defaultLinkSignature = normalizeStockLinkSignature(defaultLinks);

    if (submittedItem) {
      const submittedPrice =
        typeof submittedItem.overridePrice === "number"
          ? submittedItem.overridePrice
          : defaultPrice;
      const priceDiff = Number(submittedPrice.toFixed(2)) !== Number(defaultPrice.toFixed(2));
      const highlightDiff =
        normalizeDailyMenuText(submittedItem.highlightLabel) !== defaultHighlight;
      const submittedLinkSignature = normalizeStockLinkSignature(submittedItem.stockLinks);
      const linkDiff = submittedLinkSignature !== defaultLinkSignature;
      const explicitEnable = !defaults.enabledByDefault;
      const shouldPersist = explicitEnable || priceDiff || highlightDiff || linkDiff;

      if (!shouldPersist) {
        if (existingItem) {
          if (hasOrders) {
            await tx.dailyMenuItem.update({
              where: { id: existingItem.id },
              data: {
                overridePrice: null,
                isAvailable: true,
                highlightLabel: null,
              },
            });
          } else {
            await tx.dailyMenuItem.delete({
              where: { id: existingItem.id },
            });
          }
        }
        continue;
      }

      const savedItem = existingItem
        ? await tx.dailyMenuItem.update({
            where: { id: existingItem.id },
            data: {
              overridePrice: priceDiff ? toMoney(submittedPrice) : null,
              isAvailable: true,
              highlightLabel: highlightDiff ? submittedItem.highlightLabel : null,
            },
          })
        : await tx.dailyMenuItem.create({
            data: {
              dailyMenuId,
              menuItemId: catalogItem.id,
              overridePrice: priceDiff ? toMoney(submittedPrice) : undefined,
              isAvailable: true,
              highlightLabel: highlightDiff ? submittedItem.highlightLabel : undefined,
            },
          });

      if (linkDiff) {
        const keepLinkPoolIds = submittedItem.stockLinks.map((link) => link.dailyStockPoolId);
        await tx.dailyMenuItemStock.deleteMany({
          where: {
            dailyMenuItemId: savedItem.id,
            dailyStockPoolId: { notIn: keepLinkPoolIds },
          },
        });

        for (const link of submittedItem.stockLinks) {
          await tx.dailyMenuItemStock.upsert({
            where: {
              dailyMenuItemId_dailyStockPoolId: {
                dailyMenuItemId: savedItem.id,
                dailyStockPoolId: link.dailyStockPoolId,
              },
            },
            update: {
              consumeQuantity: toMoney(link.consumeQuantity),
            },
            create: {
              dailyMenuItemId: savedItem.id,
              dailyStockPoolId: link.dailyStockPoolId,
              consumeQuantity: toMoney(link.consumeQuantity),
            },
          });
        }
      } else if (!hasOrders) {
        await tx.dailyMenuItemStock.deleteMany({
          where: {
            dailyMenuItemId: savedItem.id,
          },
        });
      }

      continue;
    }

    if (defaults.enabledByDefault) {
      if (existingItem) {
        await tx.dailyMenuItem.update({
          where: { id: existingItem.id },
          data: {
            overridePrice: null,
            isAvailable: false,
            highlightLabel: null,
          },
        });
        if (!hasOrders) {
          await tx.dailyMenuItemStock.deleteMany({
            where: {
              dailyMenuItemId: existingItem.id,
            },
          });
        }
      } else {
        await tx.dailyMenuItem.create({
          data: {
            dailyMenuId,
            menuItemId: catalogItem.id,
            isAvailable: false,
          },
        });
      }
      continue;
    }

    if (existingItem && !hasOrders) {
      await tx.dailyMenuItem.delete({
        where: { id: existingItem.id },
      });
    }
  }

  for (const item of existingItems) {
    if (processedMenuItemIds.has(item.menuItemId)) {
      continue;
    }
    if (item._count.orderItems > 0) {
      continue;
    }
    await tx.dailyMenuItem.delete({
      where: { id: item.id },
    });
  }
}

@Route("daily-menus")
@Tags("Daily Menus")
export class DailyMenusController extends Controller {
  @Get("public/today")
  public async getPublicToday(@Query() date?: string) {
    const targetDate = date || getLocalDateInputValue();
    const menu = await getDailyMenuByCode(buildMenuCode(targetDate), DailyMenuStatus.PUBLISHED);
    if (!menu) {
      return null;
    }
    const catalogItems = await loadCatalogMenuItems(prisma);
    return serializeDailyMenu(
      buildMergedDailyMenu(menu, catalogItems, { includeUnavailableItems: false })
    );
  }

  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getDailyMenus(
    @Query() status?: DailyMenuStatus,
    @Query() date?: string
  ) {
    if (date) {
      const menus = await getMergedDailyMenusByDate(date);
      return menus
        .filter((menu) => !status || menu.status === status)
        .map(serializeDailyMenuWorkspace);
    }

    const menus = await prisma.dailyMenu.findMany({
      where: status ? { status } : undefined,
      include: dailyMenuResourceInclude,
      orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
    });
    const catalogItems = await loadCatalogMenuItems(prisma);
    return menus.map((menu) => {
      const merged = buildMergedDailyMenu(menu, catalogItems, {
        includeUnavailableItems: true,
      });
      return serializeDailyMenuSummary({
        ...merged,
        _count: {
          stockPools: merged.stockPools.length,
          items: merged.items.filter((item) => item.isAvailable).length,
        },
      });
    });
  }

  @Get("stock-baseline")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getStockBaseline(@Query() date?: string) {
    const targetDate = date || getLocalDateInputValue();
    return getStockBaselineForDate(targetDate);
  }

  @Get("{id}")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getDailyMenuById(@Path() id: number) {
    const menu = await getMergedDailyMenuById(id, true);
    return serializeDailyMenu(menu);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createDailyMenu(
    @Request() req: ExRequest,
    @Body() body: DailyMenuBody
  ) {
    const authUser = (req as any).user;
    const code = body.code || buildMenuCode(body.serviceDate);
    const serviceDate = parseDateOnly(body.serviceDate, "Ngay menu");

    const created = await prisma.$transaction(async (tx) => {
      const menu = await tx.dailyMenu.upsert({
        where: { code },
        create: {
          code,
          title: body.title,
          serviceDate,
          status: body.status ?? DailyMenuStatus.DRAFT,
          note: body.note,
          bannerText: body.bannerText,
          createdById: authUser.id,
        },
        update: {
          title: body.title,
          serviceDate,
          note: body.note,
          bannerText: body.bannerText,
        },
        select: { id: true },
      });

      await syncDailyMenuResources(tx, menu.id, body);
      return menu.id;
    });

    const menu = await getMergedDailyMenuById(created, true);
    this.setStatus(201);
    return serializeDailyMenu(menu);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateDailyMenu(@Path() id: number, @Body() body: DailyMenuBody) {
    const serviceDate = parseDateOnly(body.serviceDate, "Ngay menu");
    await prisma.$transaction(async (tx) => {
      await tx.dailyMenu.update({
        where: { id },
        data: {
          code: body.code || buildMenuCode(body.serviceDate),
          title: body.title,
          serviceDate,
          status: body.status ?? DailyMenuStatus.DRAFT,
          note: body.note,
          bannerText: body.bannerText,
        },
      });

      await syncDailyMenuResources(tx, id, body);
    });

    const menu = await getMergedDailyMenuById(id, true);
    return serializeDailyMenu(menu);
  }

  @Post("{id}/publish")
  @Security("bearerAuth", ["ADMIN"])
  public async publishDailyMenu(@Path() id: number) {
    const menu = await prisma.dailyMenu.update({
      where: { id },
      data: { status: DailyMenuStatus.PUBLISHED },
    });
    return {
      id: menu.id,
      status: menu.status,
      message: "Daily menu published",
    };
  }

  @Delete("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async deleteDailyMenu(@Path() id: number) {
    await prisma.dailyMenu.delete({ where: { id } });
    return { message: "Deleted" };
  }
}
