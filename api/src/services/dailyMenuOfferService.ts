import { MenuItemStatus, Prisma } from "@prisma/client";
import { toNumber } from "../utils/serializers";

export const catalogMenuItemInclude = {
  category: true,
  ingredientPresets: {
    include: { ingredient: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
  priceHistories: {
    orderBy: { effectiveFrom: "desc" as const },
    take: 1,
  },
};

export const dailyMenuOverrideInclude = {
  menuItem: {
    include: catalogMenuItemInclude,
  },
  stockLinks: {
    include: {
      dailyStockPool: {
        include: { ingredient: true },
      },
    },
    orderBy: { id: "asc" as const },
  },
  _count: {
    select: {
      orderItems: true,
    },
  },
};

export const dailyMenuResourceInclude = {
  stockPools: {
    include: {
      ingredient: true,
    },
    orderBy: { id: "asc" as const },
  },
  items: {
    include: dailyMenuOverrideInclude,
    orderBy: { id: "asc" as const },
  },
};

type CatalogMenuItem = Prisma.MenuItemGetPayload<{
  include: typeof catalogMenuItemInclude;
}>;

type DailyMenuWithResources = Prisma.DailyMenuGetPayload<{
  include: typeof dailyMenuResourceInclude;
}>;

type RawStockPool = DailyMenuWithResources["stockPools"][number];

type RawOverrideItem = DailyMenuWithResources["items"][number];

export type EffectiveStockLink = {
  id: number | null;
  dailyStockPoolId: number;
  consumeQuantity: number;
  dailyStockPool: RawStockPool;
};

export type DefaultOffer = {
  menuItemId: number;
  defaultPrice: number;
  defaultHighlightLabel: string | null;
  enabledByDefault: boolean;
  stockLinks: EffectiveStockLink[];
};

function normalizePositiveNumber(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function normalizeText(value?: string | null) {
  return String(value || "").trim();
}

function normalizeMoney(value: unknown) {
  return Number(normalizePositiveNumber(toNumber(value as any)).toFixed(2));
}

function isBaseMenuItemAvailable(menuItem: CatalogMenuItem) {
  return (
    menuItem.status === MenuItemStatus.ACTIVE &&
    Boolean(menuItem.isAvailable)
  );
}

export function getCurrentMenuItemPrice(menuItem: CatalogMenuItem) {
  return normalizeMoney(menuItem.currentPrice);
}

export function getDefaultHighlightLabel(menuItem: CatalogMenuItem) {
  return menuItem.isFeatured ? "Bán chạy" : null;
}

function buildPoolByIngredientMap(stockPools: RawStockPool[]) {
  const poolsByIngredient = new Map<number, RawStockPool>();
  for (const pool of stockPools) {
    if (!poolsByIngredient.has(pool.ingredientId)) {
      poolsByIngredient.set(pool.ingredientId, pool);
    }
  }
  return poolsByIngredient;
}

export function computeAvailableQuantityFromLinks(
  stockLinks: Array<{
    dailyStockPool?: { quantity?: unknown; soldQuantity?: unknown; isAvailable?: boolean | null } | null;
    consumeQuantity?: unknown;
  }>
) {
  if (!stockLinks.length) {
    return 0;
  }

  let capacity = Number.POSITIVE_INFINITY;
  for (const link of stockLinks) {
    const pool = link.dailyStockPool;
    if (!pool || pool.isAvailable === false) {
      return 0;
    }

    const quantity = normalizePositiveNumber(toNumber(pool.quantity as any));
    const soldQuantity = normalizePositiveNumber(toNumber(pool.soldQuantity as any));
    const consumeQuantity = normalizePositiveNumber(toNumber(link.consumeQuantity as any));
    if (consumeQuantity <= 0) {
      continue;
    }

    const remaining = Math.max(quantity - soldQuantity, 0);
    capacity = Math.min(capacity, Math.floor(remaining / consumeQuantity));
  }

  return Number.isFinite(capacity) ? Math.max(capacity, 0) : 0;
}

export function buildDefaultOffer(
  menuItem: CatalogMenuItem,
  stockPools: RawStockPool[]
): DefaultOffer {
  const poolsByIngredient = buildPoolByIngredientMap(stockPools);
  const stockLinks = (menuItem.ingredientPresets || [])
    .map((preset): EffectiveStockLink | null => {
      const pool = poolsByIngredient.get(preset.ingredientId);
      if (!pool) {
        return null;
      }
      return {
        id: null,
        dailyStockPoolId: pool.id,
        consumeQuantity: normalizeMoney(preset.consumeQuantity),
        dailyStockPool: pool,
      } satisfies EffectiveStockLink;
    })
    .filter((link): link is EffectiveStockLink => link !== null);

  const availableQuantity = computeAvailableQuantityFromLinks(stockLinks);
  return {
    menuItemId: menuItem.id,
    defaultPrice: getCurrentMenuItemPrice(menuItem),
    defaultHighlightLabel: getDefaultHighlightLabel(menuItem),
    enabledByDefault:
      isBaseMenuItemAvailable(menuItem) &&
      stockLinks.length > 0 &&
      availableQuantity > 0,
    stockLinks,
  };
}

export function normalizeStockLinkSignature(
  stockLinks: Array<{ dailyStockPoolId: number; consumeQuantity: number }>
) {
  return [...stockLinks]
    .map((link) => ({
      dailyStockPoolId: Number(link.dailyStockPoolId),
      consumeQuantity: normalizeMoney(link.consumeQuantity),
    }))
    .sort((left, right) => {
      if (left.dailyStockPoolId !== right.dailyStockPoolId) {
        return left.dailyStockPoolId - right.dailyStockPoolId;
      }
      return left.consumeQuantity - right.consumeQuantity;
    })
    .map((link) => `${link.dailyStockPoolId}:${link.consumeQuantity}`)
    .join("|");
}

export function buildEffectiveDailyMenuItems(
  menu: DailyMenuWithResources,
  catalogItems: CatalogMenuItem[],
  options?: {
    includeUnavailableItems?: boolean;
    limitMenuItemIds?: number[];
  }
) {
  const includeUnavailableItems = options?.includeUnavailableItems ?? true;
  const limitMenuItemIds = options?.limitMenuItemIds
    ? new Set(options.limitMenuItemIds)
    : null;
  const overrideMap = new Map<number, RawOverrideItem>();
  for (const item of menu.items) {
    overrideMap.set(item.menuItemId, item);
  }

  return catalogItems
    .filter((menuItem) => !limitMenuItemIds || limitMenuItemIds.has(menuItem.id))
    .map((menuItem) => {
      const override = overrideMap.get(menuItem.id);
      const defaults = buildDefaultOffer(menuItem, menu.stockPools);
      const hasCustomLinks = Boolean(override?.stockLinks?.length);
      const stockLinks = hasCustomLinks
        ? override!.stockLinks.map((link) => ({
            id: link.id,
            dailyStockPoolId: link.dailyStockPoolId,
            consumeQuantity: normalizeMoney(link.consumeQuantity),
            dailyStockPool: link.dailyStockPool,
          }))
        : defaults.stockLinks;
      const availableQuantity = computeAvailableQuantityFromLinks(stockLinks);
      const enabledFlag = override
        ? Boolean(override.isAvailable)
        : defaults.enabledByDefault;
      const finalIsAvailable =
        isBaseMenuItemAvailable(menuItem) && enabledFlag && availableQuantity > 0;

      return {
        id: override?.id ?? -menuItem.id,
        dailyMenuItemId: override?.id ?? null,
        menuItemId: menuItem.id,
        quantity: null,
        soldQuantity: null,
        availableQuantity,
        overridePrice: override ? toNumber(override.overridePrice) : null,
        sellingPrice: override?.overridePrice != null
          ? normalizeMoney(override.overridePrice)
          : defaults.defaultPrice,
        isAvailable: finalIsAvailable,
        highlightLabel: normalizeText(override?.highlightLabel) || defaults.defaultHighlightLabel,
        createdAt: override?.createdAt ?? menu.updatedAt,
        updatedAt: override?.updatedAt ?? menu.updatedAt,
        menuItem,
        stockLinks,
      };
    })
    .filter((item) => includeUnavailableItems || item.isAvailable);
}

export async function loadCatalogMenuItems(
  tx: Prisma.TransactionClient | Prisma.DefaultPrismaClient,
  menuItemIds?: number[]
) {
  const filterIds = Array.from(
    new Set((menuItemIds || []).filter((value) => Number.isFinite(value) && value > 0))
  );

  return tx.menuItem.findMany({
    where: filterIds.length ? { id: { in: filterIds } } : undefined,
    include: catalogMenuItemInclude,
    orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
  });
}

export function buildMergedDailyMenu(
  menu: DailyMenuWithResources,
  catalogItems: CatalogMenuItem[],
  options?: {
    includeUnavailableItems?: boolean;
    limitMenuItemIds?: number[];
  }
) {
  return {
    ...menu,
    items: buildEffectiveDailyMenuItems(menu, catalogItems, options),
  };
}

export function getEffectiveOfferForMenuItem(
  menu: DailyMenuWithResources,
  catalogItems: CatalogMenuItem[],
  menuItemId: number
) {
  const item = buildEffectiveDailyMenuItems(menu, catalogItems, {
    includeUnavailableItems: true,
    limitMenuItemIds: [menuItemId],
  })[0];
  return item || null;
}

export function normalizeDailyMenuText(value?: string | null) {
  return normalizeText(value) || null;
}
