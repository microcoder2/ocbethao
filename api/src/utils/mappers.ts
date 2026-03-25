import type {
  CustomerType,
  DailyMenuStatus,
  MenuItemStatus,
  OrderStatus,
  PaymentStatus,
  Role,
} from "@prisma/client";
import { toNumber } from "./serializers";

type AnyRecord = Record<string, any>;

function normalizePositiveNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.max(parsed, 0) : 0;
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

export function serializeOrder(order: AnyRecord) {
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
    items: Array.isArray(order.items)
      ? order.items.map((item: AnyRecord) => ({
          id: item.id,
          menuItemId: item.menuItemId ?? null,
          dailyMenuItemId: item.dailyMenuItemId ?? null,
          itemNameSnapshot: item.itemNameSnapshot,
          unitPrice: toNumber(item.unitPrice),
          quantity: item.quantity,
          lineTotal: toNumber(item.lineTotal),
          note: item.note ?? null,
          menuItem: item.menuItem ? serializeMenuItem(item.menuItem) : null,
        }))
      : [],
  };
}
