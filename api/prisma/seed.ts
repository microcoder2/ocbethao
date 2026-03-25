import bcrypt from "bcryptjs";
import {
  CustomerType,
  DailyMenuStatus,
  MenuItemStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "../src/utils/prisma";
import {
  deleteAllLocalAuthIdentities,
  upsertAuthIdentityForUser,
} from "../src/services/accountIdentityService";

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

async function seedUsers() {
  const password = await bcrypt.hash("123456", 10);

  await deleteAllLocalAuthIdentities();

  await prisma.user.upsert({
    where: { email: "admin@ocbethao.local" },
    update: {
      username: "admin",
      phone: "0909000001",
      preferredAuthProvider: "email",
    },
    create: {
      fullName: "Admin Ocbethao",
      username: "admin",
      email: "admin@ocbethao.local",
      phone: "0909000001",
      password,
      role: Role.ADMIN,
      preferredAuthProvider: "email",
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@ocbethao.local" },
    update: {
      username: "staff",
      phone: "0909000002",
      preferredAuthProvider: "email",
    },
    create: {
      fullName: "Staff Ban 1",
      username: "staff",
      email: "staff@ocbethao.local",
      phone: "0909000002",
      password,
      role: Role.STAFF,
      preferredAuthProvider: "email",
    },
  });

  await prisma.user.upsert({
    where: { phone: "0909000003" },
    update: {
      username: "khach1",
      email: "customer@ocbethao.local",
      customerType: CustomerType.REGULAR,
      preferredAuthProvider: "phone",
    },
    create: {
      fullName: "Khach Thuong Xuyen",
      username: "khach1",
      phone: "0909000003",
      email: "customer@ocbethao.local",
      password,
      role: Role.CUSTOMER,
      customerType: CustomerType.REGULAR,
      preferredAuthProvider: "phone",
    },
  });

  const users = await prisma.user.findMany({
    where: {
      OR: [
        { email: "admin@ocbethao.local" },
        { email: "staff@ocbethao.local" },
        { phone: "0909000003" },
      ],
    },
  });

  const customer = users.find((user) => user.phone === "0909000003");
  if (customer) {
    await upsertAuthIdentityForUser(customer.id, {
      provider: "zalo",
      providerUserId: "zalo-customer-0909000003",
      providerPhone: "0909000003",
      displayName: customer.fullName,
      phoneVerified: true,
    });
  }
}

async function seedCatalog(adminId: number) {
  const today = startOfToday();
  const categories = [
    {
      slug: "oc-cac-loai",
      name: "Ốc các loại",
      description: "Nhóm món chủ lực của quán",
      sortOrder: 1,
    },
    {
      slug: "so-cac-loai",
      name: "Sò các loại",
      description: "Nhóm món chế biến từ sò và hải sản cùng loại",
      sortOrder: 2,
    },
    {
      slug: "nuoc-uong",
      name: "Nước uống",
      description: "Nước giải khát và bia",
      sortOrder: 3,
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const categoryMap = await prisma.category.findMany();
  const byCategorySlug = new Map(categoryMap.map((item) => [item.slug, item.id]));

  const ingredients = [
    {
      slug: "oc-toi-size-to",
      name: "Ốc tỏi size to",
      description: "Nguồn hàng size to dùng cho các món premium",
      unit: "phần",
      imageUrl: "/uploads/placeholder-oc-toi-to.jpg",
    },
    {
      slug: "oc-toi-size-khong-lo",
      name: "Ốc tỏi size khổng lồ",
      description: "Nguồn hàng size khổng lồ phục vụ món cao cấp",
      unit: "phần",
      imageUrl: "/uploads/placeholder-oc-toi-khong-lo.jpg",
    },
    {
      slug: "so-huyet",
      name: "Sò huyết",
      description: "Nguồn sò huyết chung để chia nhiều cách chế biến",
      unit: "phần",
      imageUrl: "/uploads/placeholder-so-huyet.jpg",
    },
    {
      slug: "so-long",
      name: "Sò lông",
      description: "Nguồn sò lông dùng cho menu trong ngày",
      unit: "phần",
      imageUrl: "/uploads/placeholder-so-long.jpg",
    },
    {
      slug: "sting-do",
      name: "Sting đỏ",
      description: "Nguồn đồ uống đóng lon",
      unit: "lon",
      imageUrl: "/uploads/placeholder-sting.jpg",
    },
  ];

  for (const ingredient of ingredients) {
    await prisma.ingredient.upsert({
      where: { slug: ingredient.slug },
      update: ingredient,
      create: ingredient,
    });
  }

  const ingredientMap = await prisma.ingredient.findMany();
  const byIngredientSlug = new Map(ingredientMap.map((item) => [item.slug, item.id]));

  const menuItems = [
    {
      slug: "oc-toi-nuong-mo-hanh-size-to",
      name: "Ốc tỏi nướng mỡ hành size to",
      description: "Món premium từ ốc tỏi size to, vị đậm và thơm mỡ hành",
      basePrice: 129000,
      unit: "phần",
      categoryId: byCategorySlug.get("oc-cac-loai"),
      spicyLevel: 1,
      isFeatured: true,
      isAvailable: true,
      status: MenuItemStatus.ACTIVE,
      preparationTimeMin: 14,
      imageUrl: "/uploads/placeholder-oc-toi-to.jpg",
      ingredientPresets: [
        {
          ingredientId: byIngredientSlug.get("oc-toi-size-to"),
          consumeQuantity: 1,
        },
      ],
    },
    {
      slug: "oc-toi-sot-trung-muoi-khong-lo",
      name: "Ốc tỏi sốt trứng muối khổng lồ",
      description: "Phiên bản size khổng lồ với giá bán và nguồn hàng riêng",
      basePrice: 189000,
      unit: "phần",
      categoryId: byCategorySlug.get("oc-cac-loai"),
      spicyLevel: 0,
      isFeatured: true,
      isAvailable: true,
      status: MenuItemStatus.ACTIVE,
      preparationTimeMin: 18,
      imageUrl: "/uploads/placeholder-oc-toi-khong-lo.jpg",
      ingredientPresets: [
        {
          ingredientId: byIngredientSlug.get("oc-toi-size-khong-lo"),
          consumeQuantity: 1,
        },
      ],
    },
    {
      slug: "so-huyet-nuong-mo-hanh",
      name: "Sò huyết nướng mỡ hành",
      description: "Một trong hai cách chế biến dùng chung nguồn sò huyết",
      basePrice: 89000,
      unit: "phần",
      categoryId: byCategorySlug.get("so-cac-loai"),
      spicyLevel: 0,
      isFeatured: true,
      isAvailable: true,
      status: MenuItemStatus.ACTIVE,
      preparationTimeMin: 12,
      imageUrl: "/uploads/placeholder-so-huyet.jpg",
      ingredientPresets: [
        {
          ingredientId: byIngredientSlug.get("so-huyet"),
          consumeQuantity: 1,
        },
      ],
    },
    {
      slug: "so-huyet-xao-bo-toi",
      name: "Sò huyết xào bơ tỏi",
      description: "Món thứ hai cùng dùng chung pool sò huyết trong ngày",
      basePrice: 99000,
      unit: "phần",
      categoryId: byCategorySlug.get("so-cac-loai"),
      spicyLevel: 1,
      isFeatured: false,
      isAvailable: true,
      status: MenuItemStatus.ACTIVE,
      preparationTimeMin: 15,
      imageUrl: "/uploads/placeholder-so-huyet-xao.jpg",
      ingredientPresets: [
        {
          ingredientId: byIngredientSlug.get("so-huyet"),
          consumeQuantity: 1,
        },
      ],
    },
    {
      slug: "so-long-nuong-mo-hanh",
      name: "Sò lông nướng mỡ hành",
      description: "Món sò lông bán theo pool riêng",
      basePrice: 79000,
      unit: "phần",
      categoryId: byCategorySlug.get("so-cac-loai"),
      spicyLevel: 0,
      isFeatured: false,
      isAvailable: true,
      status: MenuItemStatus.ACTIVE,
      preparationTimeMin: 10,
      imageUrl: "/uploads/placeholder-so-long.jpg",
      ingredientPresets: [
        {
          ingredientId: byIngredientSlug.get("so-long"),
          consumeQuantity: 1,
        },
      ],
    },
    {
      slug: "sting-do",
      name: "Sting đỏ",
      description: "Nước ngọt đóng lon",
      basePrice: 18000,
      unit: "lon",
      categoryId: byCategorySlug.get("nuoc-uong"),
      spicyLevel: 0,
      isFeatured: false,
      isAvailable: true,
      status: MenuItemStatus.ACTIVE,
      preparationTimeMin: 1,
      imageUrl: "/uploads/placeholder-sting.jpg",
      ingredientPresets: [
        {
          ingredientId: byIngredientSlug.get("sting-do"),
          consumeQuantity: 1,
        },
      ],
    },
  ];

  for (const item of menuItems) {
    const categoryId = item.categoryId;
    if (!categoryId) continue;

    await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        basePrice: money(item.basePrice),
        unit: item.unit,
        categoryId,
        spicyLevel: item.spicyLevel,
        imageUrl: item.imageUrl,
        isFeatured: item.isFeatured,
        isAvailable: item.isAvailable,
        status: item.status,
        preparationTimeMin: item.preparationTimeMin,
        createdById: adminId,
        ingredientPresets: {
          deleteMany: {},
          create: item.ingredientPresets
            .filter((preset) => preset.ingredientId)
            .map((preset, index) => ({
              ingredientId: preset.ingredientId as number,
              consumeQuantity: money(preset.consumeQuantity),
              sortOrder: index,
            })),
        },
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        basePrice: money(item.basePrice),
        unit: item.unit,
        categoryId,
        spicyLevel: item.spicyLevel,
        imageUrl: item.imageUrl,
        isFeatured: item.isFeatured,
        isAvailable: item.isAvailable,
        status: item.status,
        preparationTimeMin: item.preparationTimeMin,
        createdById: adminId,
        ingredientPresets: {
          create: item.ingredientPresets
            .filter((preset) => preset.ingredientId)
            .map((preset, index) => ({
              ingredientId: preset.ingredientId as number,
              consumeQuantity: money(preset.consumeQuantity),
              sortOrder: index,
            })),
        },
      },
    });
  }

  const createdItems = await prisma.menuItem.findMany();
  for (const item of createdItems) {
    await prisma.menuItemPrice.upsert({
      where: {
        menuItemId_effectiveFrom: {
          menuItemId: item.id,
          effectiveFrom: today,
        },
      },
      update: {
        menuItemId: item.id,
        price: item.basePrice,
        effectiveFrom: today,
        note: "Giá mẫu seed v2",
      },
      create: {
        menuItemId: item.id,
        price: item.basePrice,
        effectiveFrom: today,
        note: "Giá mẫu seed v2",
      },
    });
  }
}

async function seedDailyMenu(adminId: number, customerId: number, staffId: number) {
  const today = startOfToday();
  const code = `MENU-${today.toISOString().slice(0, 10)}`;

  const dailyMenu = await prisma.dailyMenu.upsert({
    where: { code },
    update: {
      title: "Thực đơn hải sản hôm nay",
      serviceDate: today,
      status: DailyMenuStatus.PUBLISHED,
      note: "V2: quản lý stock theo pool nguồn hàng, không còn gắn tồn kho trực tiếp lên từng món.",
      bannerText: "Sò huyết hôm nay có 5 phần dùng chung cho nhiều cách chế biến.",
      createdById: adminId,
    },
    create: {
      code,
      title: "Thực đơn hải sản hôm nay",
      serviceDate: today,
      status: DailyMenuStatus.PUBLISHED,
      note: "V2: quản lý stock theo pool nguồn hàng, không còn gắn tồn kho trực tiếp lên từng món.",
      bannerText: "Sò huyết hôm nay có 5 phần dùng chung cho nhiều cách chế biến.",
      createdById: adminId,
    },
  });

  await prisma.order.deleteMany({
    where: { dailyMenuId: dailyMenu.id },
  });
  await prisma.dailyMenuItem.deleteMany({
    where: { dailyMenuId: dailyMenu.id },
  });
  await prisma.dailyStockPool.deleteMany({
    where: { dailyMenuId: dailyMenu.id },
  });

  const menuItems = await prisma.menuItem.findMany({
    where: {
      slug: {
        in: [
          "oc-toi-nuong-mo-hanh-size-to",
          "oc-toi-sot-trung-muoi-khong-lo",
          "so-huyet-nuong-mo-hanh",
          "so-huyet-xao-bo-toi",
          "so-long-nuong-mo-hanh",
          "sting-do",
        ],
      },
    },
  });
  const ingredients = await prisma.ingredient.findMany();

  const byMenuItemSlug = new Map(menuItems.map((item) => [item.slug, item]));
  const byIngredientSlug = new Map(ingredients.map((item) => [item.slug, item]));

  const stockPools = [
    {
      slug: "so-huyet",
      quantity: 5,
      note: "Pool dùng chung cho sò huyết nướng và sò huyết xào bơ tỏi",
    },
    {
      slug: "so-long",
      quantity: 4,
      note: "Pool riêng của sò lông",
    },
    {
      slug: "oc-toi-size-to",
      quantity: 6,
      note: "Pool ốc tỏi size to",
    },
    {
      slug: "oc-toi-size-khong-lo",
      quantity: 3,
      note: "Pool ốc tỏi khổng lồ",
    },
    {
      slug: "sting-do",
      quantity: 24,
      note: "Pool đồ uống",
    },
  ];

  const createdPools = new Map<string, number>();
  for (const pool of stockPools) {
    const ingredient = byIngredientSlug.get(pool.slug);
    if (!ingredient) continue;
    const created = await prisma.dailyStockPool.create({
      data: {
        dailyMenuId: dailyMenu.id,
        ingredientId: ingredient.id,
        label: ingredient.name,
        quantity: money(pool.quantity),
        note: pool.note,
      },
    });
    createdPools.set(pool.slug, created.id);
  }

  const offers = [
    {
      menuItemSlug: "so-huyet-nuong-mo-hanh",
      overridePrice: 89000,
      highlightLabel: "Bán chạy",
      stockSlug: "so-huyet",
      consumeQuantity: 1,
    },
    {
      menuItemSlug: "so-huyet-xao-bo-toi",
      overridePrice: 99000,
      highlightLabel: "Đậm vị",
      stockSlug: "so-huyet",
      consumeQuantity: 1,
    },
    {
      menuItemSlug: "so-long-nuong-mo-hanh",
      overridePrice: 79000,
      highlightLabel: "Hôm nay",
      stockSlug: "so-long",
      consumeQuantity: 1,
    },
    {
      menuItemSlug: "oc-toi-nuong-mo-hanh-size-to",
      overridePrice: 129000,
      highlightLabel: "Size to",
      stockSlug: "oc-toi-size-to",
      consumeQuantity: 1,
    },
    {
      menuItemSlug: "oc-toi-sot-trung-muoi-khong-lo",
      overridePrice: 189000,
      highlightLabel: "Khổng lồ",
      stockSlug: "oc-toi-size-khong-lo",
      consumeQuantity: 1,
    },
    {
      menuItemSlug: "sting-do",
      overridePrice: 18000,
      highlightLabel: "Giải khát",
      stockSlug: "sting-do",
      consumeQuantity: 1,
    },
  ];

  const createdOffers = new Map<string, number>();
  for (const offer of offers) {
    const menuItem = byMenuItemSlug.get(offer.menuItemSlug);
    const poolId = createdPools.get(offer.stockSlug);
    if (!menuItem || !poolId) continue;

    const created = await prisma.dailyMenuItem.create({
      data: {
        dailyMenuId: dailyMenu.id,
        menuItemId: menuItem.id,
        overridePrice: money(offer.overridePrice),
        isAvailable: true,
        highlightLabel: offer.highlightLabel,
        stockLinks: {
          create: {
            dailyStockPoolId: poolId,
            consumeQuantity: money(offer.consumeQuantity),
          },
        },
      },
    });
    createdOffers.set(offer.menuItemSlug, created.id);
  }

  const sampleOrderItems = [
    {
      menuItemSlug: "so-huyet-nuong-mo-hanh",
      quantity: 1,
    },
    {
      menuItemSlug: "so-huyet-xao-bo-toi",
      quantity: 1,
    },
    {
      menuItemSlug: "sting-do",
      quantity: 2,
    },
  ];

  const resolvedSampleItems = sampleOrderItems
    .map((item) => {
      const menuItem = byMenuItemSlug.get(item.menuItemSlug);
      const dailyMenuItemId = createdOffers.get(item.menuItemSlug);
      if (!menuItem || !dailyMenuItemId) return null;

      return {
        menuItemId: menuItem.id,
        dailyMenuItemId,
        itemNameSnapshot: menuItem.name,
        unitPrice: money(Number(menuItem.basePrice)),
        quantity: item.quantity,
        lineTotal: money(Number(menuItem.basePrice) * item.quantity),
      };
    })
    .filter(Boolean) as Array<{
    menuItemId: number;
    dailyMenuItemId: number;
    itemNameSnapshot: string;
    unitPrice: Prisma.Decimal;
    quantity: number;
    lineTotal: Prisma.Decimal;
  }>;

  const subtotal = resolvedSampleItems.reduce(
    (sum, item) => sum + Number(item.lineTotal),
    0
  );

  await prisma.order.create({
    data: {
      orderNumber: `OBT-${today.toISOString().slice(0, 10).replace(/-/g, "")}-001`,
      source: OrderSource.CUSTOMER_APP,
      status: OrderStatus.CONFIRMED,
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: PaymentMethod.TRANSFER,
      tableLabel: "Bàn Hẻm 01",
      guestCount: 2,
      guestName: "Khách Thường Xuyên",
      guestPhone: "0909000003",
      note: "Ít cay, thêm rau răm",
      subtotal: money(subtotal),
      totalAmount: money(subtotal),
      createdById: customerId,
      assignedStaffId: staffId,
      customerId,
      dailyMenuId: dailyMenu.id,
      confirmedAt: new Date(),
      items: {
        create: resolvedSampleItems,
      },
    },
  });

  await prisma.dailyStockPool.update({
    where: { id: createdPools.get("so-huyet") },
    data: { soldQuantity: money(2) },
  });
  await prisma.dailyStockPool.update({
    where: { id: createdPools.get("sting-do") },
    data: { soldQuantity: money(2) },
  });
}

async function main() {
  await seedUsers();

  const admin = await prisma.user.findUniqueOrThrow({
    where: { email: "admin@ocbethao.local" },
  });
  const staff = await prisma.user.findUniqueOrThrow({
    where: { email: "staff@ocbethao.local" },
  });
  const customer = await prisma.user.findUniqueOrThrow({
    where: { phone: "0909000003" },
  });

  await seedCatalog(admin.id);
  await seedDailyMenu(admin.id, customer.id, staff.id);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
