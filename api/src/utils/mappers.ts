import {
  CustomerType,
  DailyMenuStatus,
  MenuItemStatus,
  OrderItemStatus,
  OrderStatus,
  PaymentStatus,
  Role,
} from "@prisma/client";
import { toNumber } from "./serializers";

type AnyRecord = Record<string, any>;

type ItemStageQuantities = {
  waitingQuantity: number;
  cookingQuantity: number;
  readyQuantity: number;
  cancelledQuantity: number;
};

function normalizePositiveNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
}

function getLegacyStageQuantities(
  quantity: number,
  status: OrderItemStatus,
): ItemStageQuantities {
  if (status === OrderItemStatus.CANCELLED) {
    return {
      waitingQuantity: 0,
      cookingQuantity: 0,
      readyQuantity: 0,
      cancelledQuantity: quantity,
    };
  }

  if (status === OrderItemStatus.READY) {
    return {
      waitingQuantity: 0,
      cookingQuantity: 0,
      readyQuantity: quantity,
      cancelledQuantity: 0,
    };
  }

  if (status === OrderItemStatus.COOKING) {
    return {
      waitingQuantity: 0,
      cookingQuantity: quantity,
      readyQuantity: 0,
      cancelledQuantity: 0,
    };
  }

  return {
    waitingQuantity: quantity,
    cookingQuantity: 0,
    readyQuantity: 0,
    cancelledQuantity: 0,
  };
}

function getStageQuantities(item: AnyRecord): ItemStageQuantities {
  const quantity = normalizePositiveNumber(item.quantity);
  const fallbackStatus =
    (item.status as OrderItemStatus | null) ?? OrderItemStatus.WAITING;

  const waitingQuantity = normalizePositiveNumber(item.waitingQuantity);
  const cookingQuantity = normalizePositiveNumber(item.cookingQuantity);
  const readyQuantity = normalizePositiveNumber(item.readyQuantity);
  const cancelledQuantity = normalizePositiveNumber(item.cancelledQuantity);
  const sum =
    waitingQuantity + cookingQuantity + readyQuantity + cancelledQuantity;

  if (sum <= 0 && quantity > 0) {
    return getLegacyStageQuantities(quantity, fallbackStatus);
  }

  return {
    waitingQuantity,
    cookingQuantity,
    readyQuantity,
    cancelledQuantity,
  };
}

function getDerivedOrderItemStatus(
  quantity: number,
  stages: ItemStageQuantities,
): OrderItemStatus {
  if (stages.cancelledQuantity >= quantity && quantity > 0) {
    return OrderItemStatus.CANCELLED;
  }

  if (
    stages.readyQuantity >= quantity &&
    stages.waitingQuantity === 0 &&
    stages.cookingQuantity === 0 &&
    quantity > 0
  ) {
    return OrderItemStatus.READY;
  }

  if (stages.cookingQuantity > 0 || stages.readyQuantity > 0) {
    return OrderItemStatus.COOKING;
  }

  return OrderItemStatus.WAITING;
}

function computeOfferAvailableQuantity(item: AnyRecord): number | null {
  const links = Array.isArray(item.stockLinks) ? item.stockLinks : [];
  if (links.length === 0) {
    return null;
  }

  let capacity = Number.POSITIVE_INFINITY;
  for (const link of links) {
    const pool = link.dailyStockPool;
    if (!pool || pool.isAvailable === false) {
      return 0;
    }

    const quantity = normalizePositiveNumber(toNumber(pool.quantity));
    const soldQuantity = normalizePositiveNumber(toNumber(pool.soldQuantity));
    const consumeQuantity = normalizePositiveNumber(toNumber(link.consumeQuantity));
    if (consumeQuantity <= 0) {
      continue;
    }

    const remaining = Math.max(quantity - soldQuantity, 0);
    capacity = Math.min(capacity, Math.floor(remaining / consumeQuantity));
  }

  return Number.isFinite(capacity) ? Math.max(capacity, 0) : null;
}

export function serializeUser(user: AnyRecord) {
  const authIdentities = Array.isArray(user.authIdentities)
    ? user.authIdentities
        .filter((identity: AnyRecord) => !identity.revokedAt)
        .map((identity: AnyRecord) => ({
          id: identity.id,
          provider: identity.provider,
          providerUserId: identity.providerUserId,
          providerEmail: identity.providerEmail ?? null,
          providerPhone: identity.providerPhone ?? null,
          providerUsername: identity.providerUsername ?? null,
          displayName: identity.displayName ?? null,
          avatarUrl: identity.avatarUrl ?? null,
          emailVerified: Boolean(identity.emailVerified),
          phoneVerified: Boolean(identity.phoneVerified),
          linkedAt: identity.linkedAt,
          lastLoginAt: identity.lastLoginAt ?? null,
        }))
    : [];

  return {
    id: user.id,
    fullName: user.fullName,
    role: user.role as Role,
    username: user.username ?? null,
    phone: user.phone ?? null,
    email: user.email ?? null,
    preferredAuthProvider: user.preferredAuthProvider ?? null,
    customerType: (user.customerType as CustomerType | null) ?? null,
    avatarUrl: user.avatarUrl ?? null,
    notes: user.notes ?? null,
    isActive: Boolean(user.isActive),
    hasPassword: Boolean(user.password),
    linkedAuthProviders: authIdentities.map((identity: AnyRecord) => identity.provider),
    authIdentities,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export function serializeCategory(category: AnyRecord) {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description ?? null,
    sortOrder: category.sortOrder,
    isActive: Boolean(category.isActive),
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

export function serializeIngredient(ingredient: AnyRecord) {
  return {
    id: ingredient.id,
    name: ingredient.name,
    slug: ingredient.slug,
    description: ingredient.description ?? null,
    unit: ingredient.unit,
    imageUrl: ingredient.imageUrl ?? null,
    isActive: Boolean(ingredient.isActive),
    createdAt: ingredient.createdAt,
    updatedAt: ingredient.updatedAt,
  };
}

export function serializeMenuItem(item: AnyRecord) {
  const latestPrice = Array.isArray(item.priceHistories) ? item.priceHistories[0] : null;
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description ?? null,
    unit: item.unit,
    spicyLevel: item.spicyLevel ?? null,
    imageUrl: item.imageUrl ?? null,
    basePrice: toNumber(item.basePrice),
    currentPrice: toNumber(latestPrice?.price ?? item.basePrice),
    status: item.status as MenuItemStatus,
    isFeatured: Boolean(item.isFeatured),
    isAvailable: Boolean(item.isAvailable),
    preparationTimeMin: item.preparationTimeMin ?? null,
    category: item.category ? serializeCategory(item.category) : null,
    createdById: item.createdById ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    ingredientPresets: Array.isArray(item.ingredientPresets)
      ? item.ingredientPresets.map((preset: AnyRecord) => ({
          id: preset.id,
          ingredientId: preset.ingredientId,
          consumeQuantity: toNumber(preset.consumeQuantity),
          sortOrder: preset.sortOrder ?? 0,
          note: preset.note ?? null,
          ingredient: preset.ingredient ? serializeIngredient(preset.ingredient) : null,
        }))
      : [],
    priceHistories: Array.isArray(item.priceHistories)
      ? item.priceHistories.map((price: AnyRecord) => ({
          id: price.id,
          price: toNumber(price.price),
          effectiveFrom: price.effectiveFrom,
          effectiveTo: price.effectiveTo ?? null,
          note: price.note ?? null,
          createdAt: price.createdAt,
        }))
      : [],
  };
}

export function serializeDailyStockPool(pool: AnyRecord) {
  const quantity = normalizePositiveNumber(toNumber(pool.quantity));
  const soldQuantity = normalizePositiveNumber(toNumber(pool.soldQuantity));
  return {
    id: pool.id,
    label: pool.label ?? pool.ingredient?.name ?? null,
    quantity,
    soldQuantity,
    remainingQuantity: Math.max(quantity - soldQuantity, 0),
    isAvailable: Boolean(pool.isAvailable),
    note: pool.note ?? null,
    createdAt: pool.createdAt,
    updatedAt: pool.updatedAt,
    ingredient: pool.ingredient ? serializeIngredient(pool.ingredient) : null,
  };
}

export function serializeDailyMenuItem(item: AnyRecord) {
  const availableQuantity = computeOfferAvailableQuantity(item);
  return {
    id: item.id,
    quantity: null,
    soldQuantity: null,
    availableQuantity,
    overridePrice: toNumber(item.overridePrice),
    sellingPrice: toNumber(item.overridePrice ?? item.menuItem?.basePrice),
    isAvailable: Boolean(item.isAvailable) && availableQuantity !== 0,
    highlightLabel: item.highlightLabel ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    menuItem: item.menuItem ? serializeMenuItem(item.menuItem) : null,
    stockLinks: Array.isArray(item.stockLinks)
      ? item.stockLinks.map((link: AnyRecord) => ({
          id: link.id,
          dailyStockPoolId: link.dailyStockPoolId,
          consumeQuantity: toNumber(link.consumeQuantity),
          stockPool: link.dailyStockPool ? serializeDailyStockPool(link.dailyStockPool) : null,
        }))
      : [],
  };
}

export function serializeDailyMenu(menu: AnyRecord) {
  return {
    id: menu.id,
    code: menu.code,
    title: menu.title,
    serviceDate: menu.serviceDate,
    status: menu.status as DailyMenuStatus,
    note: menu.note ?? null,
    bannerText: menu.bannerText ?? null,
    createdById: menu.createdById ?? null,
    createdAt: menu.createdAt,
    updatedAt: menu.updatedAt,
    stockPools: Array.isArray(menu.stockPools)
      ? menu.stockPools.map(serializeDailyStockPool)
      : [],
    items: Array.isArray(menu.items)
      ? menu.items.map(serializeDailyMenuItem)
      : [],
  };
}

function serializeDailyStockPoolSummary(pool: AnyRecord) {
  const quantity = normalizePositiveNumber(toNumber(pool.quantity));
  const soldQuantity = normalizePositiveNumber(toNumber(pool.soldQuantity));
  return {
    id: pool.id,
    ingredientId: pool.ingredientId ?? null,
    label: pool.label ?? null,
    quantity,
    soldQuantity,
    remainingQuantity: Math.max(quantity - soldQuantity, 0),
    isAvailable: Boolean(pool.isAvailable),
    note: pool.note ?? null,
  };
}

function serializeDailyStockPoolLink(pool: AnyRecord) {
  const quantity = normalizePositiveNumber(toNumber(pool.quantity));
  const soldQuantity = normalizePositiveNumber(toNumber(pool.soldQuantity));
  return {
    id: pool.id,
    label: pool.label ?? null,
    remainingQuantity: Math.max(quantity - soldQuantity, 0),
  };
}

function serializeDailyMenuItemSummary(item: AnyRecord) {
  const availableQuantity = computeOfferAvailableQuantity(item);
  return {
    id: item.id,
    availableQuantity,
    overridePrice: toNumber(item.overridePrice),
    sellingPrice: toNumber(item.overridePrice ?? item.menuItem?.basePrice),
    isAvailable: Boolean(item.isAvailable) && availableQuantity !== 0,
    highlightLabel: item.highlightLabel ?? null,
    menuItem: item.menuItem
      ? {
          id: item.menuItem.id,
          name: item.menuItem.name,
        }
      : null,
    stockLinks: Array.isArray(item.stockLinks)
      ? item.stockLinks.map((link: AnyRecord) => ({
          id: link.id,
          dailyStockPoolId: link.dailyStockPoolId,
          consumeQuantity: toNumber(link.consumeQuantity),
          stockPool: link.dailyStockPool
            ? serializeDailyStockPoolLink(link.dailyStockPool)
            : null,
        }))
      : [],
  };
}

export function serializeDailyMenuWorkspace(menu: AnyRecord) {
  return {
    id: menu.id,
    title: menu.title,
    serviceDate: menu.serviceDate,
    status: menu.status as DailyMenuStatus,
    note: menu.note ?? null,
    bannerText: menu.bannerText ?? null,
    stockPools: Array.isArray(menu.stockPools)
      ? menu.stockPools.map(serializeDailyStockPoolSummary)
      : [],
    items: Array.isArray(menu.items)
      ? menu.items.map(serializeDailyMenuItemSummary)
      : [],
  };
}

export function serializeDailyMenuSummary(menu: AnyRecord) {
  return {
    id: menu.id,
    title: menu.title,
    serviceDate: menu.serviceDate,
    status: menu.status as DailyMenuStatus,
    note: menu.note ?? null,
    bannerText: menu.bannerText ?? null,
    stockPoolCount: Number(menu._count?.stockPools || 0),
    itemCount: Number(menu._count?.items || 0),
  };
}

function serializeOrderItems(items: AnyRecord[]) {
  return items.map((item: AnyRecord) => {
    const quantity = normalizePositiveNumber(item.quantity);
    const stages = getStageQuantities(item);
    const activeQuantity =
      stages.waitingQuantity + stages.cookingQuantity + stages.readyQuantity;
    return {
      id: item.id,
      menuItemId: item.menuItemId ?? null,
      dailyMenuItemId: item.dailyMenuItemId ?? null,
      itemNameSnapshot: item.itemNameSnapshot,
      unitPrice: toNumber(item.unitPrice),
      quantity,
      activeQuantity,
      waitingQuantity: stages.waitingQuantity,
      cookingQuantity: stages.cookingQuantity,
      readyQuantity: stages.readyQuantity,
      cancelledQuantity: stages.cancelledQuantity,
      status: getDerivedOrderItemStatus(quantity, stages),
      lineTotal: toNumber(item.lineTotal),
      activeLineTotal: Number(item.unitPrice || 0) * activeQuantity,
      note: item.note ?? null,
      menuItem: item.menuItem ? serializeMenuItem(item.menuItem) : null,
    };
  });
}

function serializeOrderListItems(items: AnyRecord[]) {
  return items.map((item: AnyRecord) => {
    const quantity = normalizePositiveNumber(item.quantity);
    const stages = getStageQuantities(item);
    const activeQuantity =
      stages.waitingQuantity + stages.cookingQuantity + stages.readyQuantity;
    return {
      id: item.id,
      menuItemId: item.menuItemId ?? null,
      dailyMenuItemId: item.dailyMenuItemId ?? null,
      itemNameSnapshot: item.itemNameSnapshot,
      unitPrice: toNumber(item.unitPrice),
      quantity,
      activeQuantity,
      waitingQuantity: stages.waitingQuantity,
      cookingQuantity: stages.cookingQuantity,
      readyQuantity: stages.readyQuantity,
      cancelledQuantity: stages.cancelledQuantity,
      status: getDerivedOrderItemStatus(quantity, stages),
      lineTotal: toNumber(item.lineTotal),
      activeLineTotal: Number(item.unitPrice || 0) * activeQuantity,
    };
  });
}

function buildOrderItemProgress(items: AnyRecord[]) {
  const progress = {
    total: 0,
    waiting: 0,
    cooking: 0,
    ready: 0,
    cancelled: 0,
  };

  for (const item of items) {
    const stages = getStageQuantities(item);
    progress.waiting += stages.waitingQuantity;
    progress.cooking += stages.cookingQuantity;
    progress.ready += stages.readyQuantity;
    progress.cancelled += stages.cancelledQuantity;
    progress.total +=
      stages.waitingQuantity + stages.cookingQuantity + stages.readyQuantity;
  }

  return progress;
}

export function serializeOrderList(order: AnyRecord) {
  const items = Array.isArray(order.items) ? serializeOrderListItems(order.items) : [];
  const itemProgress = buildOrderItemProgress(items);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    status: order.status as OrderStatus,
    paymentStatus: order.paymentStatus as PaymentStatus,
    paymentMethod: order.paymentMethod ?? null,
    tableLabel: order.tableLabel ?? null,
    guestCount: order.guestCount ?? null,
    guestName: order.guestName ?? null,
    guestPhone: order.guestPhone ?? null,
    arrivalAt: order.arrivalAt ?? null,
    subtotal: toNumber(order.subtotal),
    serviceFee: toNumber(order.serviceFee),
    discountAmount: toNumber(order.discountAmount),
    totalAmount: toNumber(order.totalAmount),
    dailyMenuId: order.dailyMenuId ?? null,
    createdAt: order.createdAt,
    customer: order.customer
      ? {
          fullName: order.customer.fullName,
          phone: order.customer.phone ?? null,
        }
      : null,
    itemProgress,
    items,
  };
}

export function serializeOrder(order: AnyRecord) {
  const items = Array.isArray(order.items) ? serializeOrderItems(order.items) : [];
  const itemProgress = buildOrderItemProgress(items);

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    source: order.source,
    status: order.status as OrderStatus,
    paymentStatus: order.paymentStatus as PaymentStatus,
    paymentMethod: order.paymentMethod ?? null,
    tableLabel: order.tableLabel ?? null,
    guestCount: order.guestCount ?? null,
    guestName: order.guestName ?? null,
    guestPhone: order.guestPhone ?? null,
    note: order.note ?? null,
    internalNote: order.internalNote ?? null,
    arrivalAt: order.arrivalAt ?? null,
    subtotal: toNumber(order.subtotal),
    serviceFee: toNumber(order.serviceFee),
    discountAmount: toNumber(order.discountAmount),
    totalAmount: toNumber(order.totalAmount),
    createdById: order.createdById ?? null,
    assignedStaffId: order.assignedStaffId ?? null,
    customerId: order.customerId ?? null,
    dailyMenuId: order.dailyMenuId ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    confirmedAt: order.confirmedAt ?? null,
    completedAt: order.completedAt ?? null,
    customer: order.customer ? serializeUser(order.customer) : null,
    assignedStaff: order.assignedStaff ? serializeUser(order.assignedStaff) : null,
    itemProgress,
    items,
  };
}
