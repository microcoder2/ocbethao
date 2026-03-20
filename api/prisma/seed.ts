import bcrypt from "bcryptjs";
import {
  AuthProvider,
  CustomerType,
  DailyMenuStatus,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Role,
} from "@prisma/client";
import { prisma } from "../src/utils/prisma";

function startOfToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

async function seedUsers() {
  const password = await bcrypt.hash("123456", 10);

  await prisma.user.upsert({
    where: { email: "admin@ocbethao.local" },
    update: {
      username: "admin",
      phone: "0909000001",
      preferredAuthProvider: AuthProvider.EMAIL,
    },
    create: {
      fullName: "Admin Ocbethao",
      username: "admin",
      email: "admin@ocbethao.local",
      phone: "0909000001",
      password,
      role: Role.ADMIN,
      preferredAuthProvider: AuthProvider.EMAIL,
    },
  });

  await prisma.user.upsert({
    where: { email: "staff@ocbethao.local" },
    update: {
      username: "staff",
      phone: "0909000002",
      preferredAuthProvider: AuthProvider.EMAIL,
    },
    create: {
      fullName: "Staff Ban 1",
      username: "staff",
      email: "staff@ocbethao.local",
      phone: "0909000002",
      password,
      role: Role.STAFF,
      preferredAuthProvider: AuthProvider.EMAIL,
    },
  });

  await prisma.user.upsert({
    where: { phone: "0909000003" },
    update: {
      username: "khach1",
      email: "customer@ocbethao.local",
      customerType: CustomerType.REGULAR,
      preferredAuthProvider: AuthProvider.PHONE,
    },
    create: {
      fullName: "Khach Thuong Xuyen",
      username: "khach1",
      phone: "0909000003",
      email: "customer@ocbethao.local",
      password,
      role: Role.CUSTOMER,
      customerType: CustomerType.REGULAR,
      preferredAuthProvider: AuthProvider.PHONE,
    },
  });
}

async function seedCatalog(adminId: number) {
  const today = startOfToday();
  const categories = [
    {
      slug: "oc-cac-loai",
      name: "Oc Cac Loai",
      description: "Nhom mon chu luc cua quan",
      sortOrder: 1,
    },
    {
      slug: "hai-san-nuong",
      name: "Hai San Nuong",
      description: "Mon nuong cho buoi toi",
      sortOrder: 2,
    },
    {
      slug: "nuoc-uong",
      name: "Nuoc Uong",
      description: "Nuoc giai khat va bia",
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
  const bySlug = new Map(categoryMap.map((item) => [item.slug, item.id]));

  const menuItems = [
    {
      slug: "oc-huong-xao-bo-toi",
      name: "Oc Huong Xao Bo Toi",
      description: "Mon signature placeholder, se doi noi dung sau",
      basePrice: 89000,
      unit: "phan",
      categoryId: bySlug.get("oc-cac-loai"),
      spicyLevel: 2,
      isFeatured: true,
      preparationTimeMin: 12,
      imageUrl: "/uploads/placeholder-oc-huong.jpg",
    },
    {
      slug: "oc-mo-hanh",
      name: "Oc Mo Hanh",
      description: "Oc mo beo, mo hanh dam vi",
      basePrice: 79000,
      unit: "phan",
      categoryId: bySlug.get("oc-cac-loai"),
      spicyLevel: 1,
      preparationTimeMin: 10,
      imageUrl: "/uploads/placeholder-oc-mo.jpg",
    },
    {
      slug: "so-diep-nuong-mo-hanh",
      name: "So Diep Nuong Mo Hanh",
      description: "Mon nuong phu hop order tai ban",
      basePrice: 99000,
      unit: "phan",
      categoryId: bySlug.get("hai-san-nuong"),
      spicyLevel: 0,
      preparationTimeMin: 15,
      imageUrl: "/uploads/placeholder-so-diep.jpg",
    },
    {
      slug: "sting-do",
      name: "Sting Do",
      description: "Nuoc ngot",
      basePrice: 18000,
      unit: "lon",
      categoryId: bySlug.get("nuoc-uong"),
      spicyLevel: 0,
      preparationTimeMin: 1,
      imageUrl: "/uploads/placeholder-sting.jpg",
    },
  ];

  for (const item of menuItems) {
    const categoryId = item.categoryId;
    if (!categoryId) continue;
    const created = await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {
        ...item,
        categoryId,
        basePrice: money(item.basePrice),
        createdById: adminId,
      },
      create: {
        ...item,
        categoryId,
        basePrice: money(item.basePrice),
        createdById: adminId,
      },
    });

    await prisma.menuItemPrice.upsert({
      where: {
        menuItemId_effectiveFrom: {
          menuItemId: created.id,
          effectiveFrom: today,
        },
      },
      update: {
        menuItemId: created.id,
        price: money(item.basePrice),
        effectiveFrom: today,
        note: "Gia seed ban dau",
      },
      create: {
        menuItemId: created.id,
        price: money(item.basePrice),
        effectiveFrom: today,
        note: "Gia seed ban dau",
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
      title: "Thuc Don Hom Nay",
      serviceDate: today,
      status: DailyMenuStatus.PUBLISHED,
      note: "Placeholder cho thuc don thuc te cua quan",
      bannerText: "Hom nay co mon signature va mon nuong ban chay",
      createdById: adminId,
    },
    create: {
      code,
      title: "Thuc Don Hom Nay",
      serviceDate: today,
      status: DailyMenuStatus.PUBLISHED,
      note: "Placeholder cho thuc don thuc te cua quan",
      bannerText: "Hom nay co mon signature va mon nuong ban chay",
      createdById: adminId,
    },
  });

  const items = await prisma.menuItem.findMany({
    take: 4,
    orderBy: { id: "asc" },
  });

  for (const item of items) {
    const overridePrice =
      item.slug === "oc-huong-xao-bo-toi" ? money(95000) : item.basePrice;

    await prisma.dailyMenuItem.upsert({
      where: {
        dailyMenuId_menuItemId: {
          dailyMenuId: dailyMenu.id,
          menuItemId: item.id,
        },
      },
      update: {
        quantity: item.unit === "lon" ? 48 : 20,
        overridePrice,
        isAvailable: true,
        highlightLabel: item.isFeatured ? "Ban chay" : "Hom nay",
      },
      create: {
        dailyMenuId: dailyMenu.id,
        menuItemId: item.id,
        quantity: item.unit === "lon" ? 48 : 20,
        overridePrice,
        isAvailable: true,
        highlightLabel: item.isFeatured ? "Ban chay" : "Hom nay",
      },
    });
  }

  const dailyItems = await prisma.dailyMenuItem.findMany({
    where: { dailyMenuId: dailyMenu.id },
    include: { menuItem: true },
    orderBy: { id: "asc" },
  });

  const orderNumber = `OBT-${today.toISOString().slice(0, 10).replace(/-/g, "")}-001`;
  const subtotal = dailyItems.slice(0, 2).reduce((sum, item) => {
    const price = Number(item.overridePrice ?? item.menuItem.basePrice);
    return sum + price;
  }, 0);

  const existing = await prisma.order.findUnique({ where: { orderNumber } });
  if (!existing) {
    await prisma.order.create({
      data: {
        orderNumber,
        source: OrderSource.CUSTOMER_APP,
        status: OrderStatus.CONFIRMED,
        paymentStatus: PaymentStatus.PAID,
        paymentMethod: PaymentMethod.TRANSFER,
        tableLabel: "Ban Hem 01",
        guestCount: 2,
        guestName: "Khach Thuong Xuyen",
        guestPhone: "0909000003",
        note: "It cay, them rau ram",
        subtotal: money(subtotal),
        totalAmount: money(subtotal),
        createdById: customerId,
        assignedStaffId: staffId,
        customerId,
        dailyMenuId: dailyMenu.id,
        confirmedAt: new Date(),
        completedAt: new Date(),
        items: {
          create: dailyItems.slice(0, 2).map((item) => {
            const unitPrice = money(Number(item.overridePrice ?? item.menuItem.basePrice));
            return {
              menuItemId: item.menuItemId,
              dailyMenuItemId: item.id,
              itemNameSnapshot: item.menuItem.name,
              unitPrice,
              quantity: 1,
              lineTotal: unitPrice,
            };
          }),
        },
      },
    });
  }
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
