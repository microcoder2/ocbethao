import type { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { toNumber } from "../utils/serializers";

const menuItemCatalogInclude = {
  category: true,
  ingredientPresets: {
    include: { ingredient: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
};

export type CatalogMenuItem = Prisma.MenuItemGetPayload<{
  include: typeof menuItemCatalogInclude;
}>;

type IngredientStockRecord = Awaited<ReturnType<typeof loadCurrentIngredientStocks>>[number];

export async function loadCurrentIngredientStocks(
  tx: Prisma.TransactionClient | typeof prisma = prisma
) {
  return tx.ingredientStock.findMany({
    include: { ingredient: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
  });
}

export async function loadCatalogMenuItemsWithCurrentStock(
  tx: Prisma.TransactionClient | typeof prisma = prisma,
  options: {
    publicOnly?: boolean;
    search?: string;
  } = {}
) {
  const where: Prisma.MenuItemWhereInput = {};
  if (options.publicOnly) {
    where.status = "ACTIVE";
    where.isAvailable = true;
  }
  if (options.search?.trim()) {
    where.OR = [
      { name: { contains: options.search.trim() } },
      { slug: { contains: options.search.trim() } },
    ];
  }

  const [items, stocks] = await Promise.all([
    tx.menuItem.findMany({
      where,
      include: menuItemCatalogInclude,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    }),
    loadCurrentIngredientStocks(tx),
  ]);

  const stockByIngredientId = new Map<number, IngredientStockRecord>();
  for (const stock of stocks) {
    if (typeof stock.ingredientId === "number") {
      stockByIngredientId.set(stock.ingredientId, stock);
    }
  }

  return items.map((item) => buildCatalogOption(item, stockByIngredientId));
}

export function buildCatalogOption(
  item: CatalogMenuItem,
  stockByIngredientId: Map<number, IngredientStockRecord>
) {
  const stockLinks = (item.ingredientPresets || []).map((preset) => {
    const ingredientId = typeof preset.ingredientId === "number" ? preset.ingredientId : null;
    const stock = ingredientId === null ? null : stockByIngredientId.get(ingredientId) ?? null;
    const quantity = stock ? Math.max(toNumber(stock.quantity ?? 0) ?? 0, 0) : 0;
    const soldQuantity = stock ? Math.max(toNumber(stock.soldQuantity ?? 0) ?? 0, 0) : 0;
    const consumeQuantity = Math.max(toNumber(preset.consumeQuantity ?? 0) ?? 0, 0);

    return {
      ingredientId,
      consumeQuantity,
      stockPool: stock
        ? {
            id: stock.id,
            label: stock.label ?? stock.ingredient?.name ?? preset.ingredient?.name ?? null,
            remainingQuantity: Math.max(quantity - soldQuantity, 0),
            isAvailable: Boolean(stock.isAvailable),
          }
        : null,
    };
  });

  const capacities = stockLinks
    .map((link) => {
      if (!link.stockPool?.isAvailable) return 0;
      if (link.consumeQuantity <= 0) return Number.POSITIVE_INFINITY;
      return Math.floor((link.stockPool.remainingQuantity ?? 0) / link.consumeQuantity);
    })
    .filter((value) => Number.isFinite(value));

  const availableQuantity =
    capacities.length > 0 ? Math.max(Math.min(...capacities), 0) : null;

  return {
    id: item.id,
    menuItemId: item.id,
    sellingPrice: toNumber(item.currentPrice),
    isAvailable:
      Boolean(item.isAvailable) &&
      item.status === "ACTIVE" &&
      (availableQuantity === null || availableQuantity > 0),
    availableQuantity,
    stockLinks,
    menuItem: {
      id: item.id,
      name: item.name,
      category: item.category ? { id: item.category.id, name: item.category.name } : null,
    },
  };
}

export function buildPublicCatalogPayload(
  items: Awaited<ReturnType<typeof loadCatalogMenuItemsWithCurrentStock>>
) {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  const serviceDate = local.toISOString().slice(0, 10);
  return {
    id: 0,
    title: "Ngan hang mon",
    serviceDate,
    note: null,
    bannerText: null,
    items,
  };
}
