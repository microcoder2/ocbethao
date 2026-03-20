import type { CustomerType, DailyMenuStatus, MenuItemStatus, OrderStatus, PaymentStatus, Role } from "@prisma/client";
import { toNumber } from "./serializers";

type AnyRecord = Record<string, any>;

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

export function serializeDailyMenuItem(item: AnyRecord) {
  const quantity = typeof item.quantity === "number" ? item.quantity : null;
  const soldQuantity = Number(item.soldQuantity || 0);
  return {
    id: item.id,
    quantity,
    soldQuantity,
    availableQuantity:
      quantity === null ? null : Math.max(quantity - soldQuantity, 0),
    overridePrice: toNumber(item.overridePrice),
    sellingPrice: toNumber(item.overridePrice ?? item.menuItem?.basePrice),
    isAvailable: Boolean(item.isAvailable),
    highlightLabel: item.highlightLabel ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    menuItem: item.menuItem ? serializeMenuItem(item.menuItem) : null,
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
