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

type SeedUserKey =
  | "admin"
  | "staffMai"
  | "staffKhanh"
  | "lanAnh"
  | "quocPhuc"
  | "minhChau"
  | "anNhi";

type SeedUserProfile = {
  fullName: string;
  username: string;
  email?: string;
  phone?: string;
  role: Role;
  customerType?: CustomerType;
  preferredAuthProvider: string;
};

type SeedOrderSpec = {
  code: string;
  createdByKey: SeedUserKey;
  assignedStaffKey?: SeedUserKey;
  customerKey?: SeedUserKey;
  source: OrderSource;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  tableLabel?: string;
  guestCount?: number;
  guestName?: string;
  guestPhone?: string;
  note?: string;
  internalNote?: string;
  serviceFee?: number;
  discountAmount?: number;
  createdAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  items: Array<{
    menuItemSlug: string;
    quantity: number;
    note?: string;
  }>;
};

type ServiceDayInput = {
  day: Date;
  status: DailyMenuStatus;
  title: string;
  note: string;
  bannerText: string;
  orderSpecs: SeedOrderSpec[];
};

function startOfDay(base = new Date()): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  return startOfDay(next);
}

function atTime(day: Date, hours: number, minutes: number): Date {
  const next = new Date(day);
  next.setHours(hours, minutes, 0, 0);
  return next;
}

function dateKey(day: Date): string {
  const year = day.getFullYear();
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${year}-${month}-${date}`;
}

function money(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function shouldCountTowardsSoldQuantity(status: OrderStatus): boolean {
  return status !== OrderStatus.CANCELLED;
}

async function seedUsers() {
  const password = await bcrypt.hash("123456", 10);

  await deleteAllLocalAuthIdentities();

  const profiles: Record<SeedUserKey, SeedUserProfile> = {
    admin: {
      fullName: "Quản trị viên Ốc Bé Thảo",
      username: "admin",
      email: "admin@ocbethao.local",
      phone: "0909000001",
      role: Role.ADMIN,
      preferredAuthProvider: "email",
    },
    staffMai: {
      fullName: "Nguyễn Thị Mai",
      username: "mai.phucvu",
      email: "mai@ocbethao.local",
      phone: "0909000002",
      role: Role.STAFF,
      preferredAuthProvider: "email",
    },
    staffKhanh: {
      fullName: "Trần Khánh Duy",
      username: "khanh.bep",
      email: "khanh@ocbethao.local",
      phone: "0909000004",
      role: Role.STAFF,
      preferredAuthProvider: "email",
    },
    lanAnh: {
      fullName: "Lê Lan Anh",
      username: "lananh",
      email: "lananh@ocbethao.local",
      phone: "0909000003",
      role: Role.CUSTOMER,
      customerType: CustomerType.REGULAR,
      preferredAuthProvider: "phone",
    },
    quocPhuc: {
      fullName: "Phạm Quốc Phúc",
      username: "quocphuc",
      email: "quocphuc@ocbethao.local",
      phone: "0909000005",
      role: Role.CUSTOMER,
      customerType: CustomerType.VIP,
      preferredAuthProvider: "phone",
    },
    minhChau: {
      fullName: "Trịnh Minh Châu",
      username: "minhchau",
      email: "minhchau@ocbethao.local",
      phone: "0909000006",
      role: Role.CUSTOMER,
      customerType: CustomerType.OFFICE,
      preferredAuthProvider: "email",
    },
    anNhi: {
      fullName: "Đỗ An Nhi",
      username: "annhi",
      email: "annhi@ocbethao.local",
      phone: "0909000007",
      role: Role.CUSTOMER,
      customerType: CustomerType.TOURIST,
      preferredAuthProvider: "google",
    },
  };

  for (const profile of Object.values(profiles)) {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: profile.username },
          ...(profile.email ? [{ email: profile.email }] : []),
          ...(profile.phone ? [{ phone: profile.phone }] : []),
        ],
      },
    });

    const data = {
      fullName: profile.fullName,
      username: profile.username,
      phone: profile.phone,
      email: profile.email,
      password,
      role: profile.role,
      customerType: profile.customerType,
      preferredAuthProvider: profile.preferredAuthProvider,
      isActive: true,
    };

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data,
      });
      continue;
    }

    await prisma.user.create({
      data,
    });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: Object.values(profiles).map((profile) =>
        profile.email ? { email: profile.email } : { phone: profile.phone as string }
      ),
    },
  });

  const byKey = new Map<SeedUserKey, (typeof users)[number]>();
  for (const [key, profile] of Object.entries(profiles) as Array<[SeedUserKey, SeedUserProfile]>) {
    const user = users.find((item) =>
      profile.email ? item.email === profile.email : item.phone === profile.phone
    );
    if (user) {
      byKey.set(key, user);
    }
  }

  const lanAnh = byKey.get("lanAnh");
  const quocPhuc = byKey.get("quocPhuc");
  const minhChau = byKey.get("minhChau");
  const anNhi = byKey.get("anNhi");

  if (lanAnh) {
    await upsertAuthIdentityForUser(lanAnh.id, {
      provider: "zalo",
      providerUserId: "zalo-lan-anh-0909000003",
      providerPhone: lanAnh.phone ?? undefined,
      displayName: lanAnh.fullName,
      phoneVerified: true,
    });
  }

  if (quocPhuc) {
    await upsertAuthIdentityForUser(quocPhuc.id, {
      provider: "facebook",
      providerUserId: "facebook-quoc-phuc-001",
      providerPhone: quocPhuc.phone ?? undefined,
      displayName: quocPhuc.fullName,
      phoneVerified: true,
    });
  }

  if (minhChau) {
    await upsertAuthIdentityForUser(minhChau.id, {
      provider: "google",
      providerUserId: "google-minh-chau-001",
      providerEmail: minhChau.email ?? undefined,
      displayName: minhChau.fullName,
      emailVerified: true,
    });
  }

  if (anNhi) {
    await upsertAuthIdentityForUser(anNhi.id, {
      provider: "google",
      providerUserId: "google-an-nhi-001",
      providerEmail: anNhi.email ?? undefined,
      displayName: anNhi.fullName,
      emailVerified: true,
    });
  }

  return Object.fromEntries(
    Array.from(byKey.entries()).map(([key, user]) => [key, user])
  ) as Record<SeedUserKey, (typeof users)[number]>;
}

async function seedCatalog(adminId: number) {
  const today = startOfDay();

  const categories = [
    {
      slug: "oc-cac-loai",
      name: "Ốc các loại",
      description: "Các món ốc chủ lực của quán, vị đậm và dễ bán.",
      sortOrder: 1,
    },
    {
      slug: "so-ngheu",
      name: "Sò, nghêu và hai mảnh",
      description: "Nhóm hải sản nướng, hấp và rang muối theo ngày.",
      sortOrder: 2,
    },
    {
      slug: "mon-an-kem",
      name: "Món ăn kèm",
      description: "Món phụ ăn chung để cân vị và upsell bàn ăn.",
      sortOrder: 3,
    },
    {
      slug: "nuoc-uong",
      name: "Nước uống",
      description: "Đồ uống phục vụ tại bàn và giao đi.",
      sortOrder: 4,
    },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const ingredientSeeds = [
    {
      slug: "oc-huong-tuoi",
      name: "Ốc hương tươi",
      description: "Nguồn ốc hương dùng cho các món rang muối và sốt trứng muối.",
      unit: "phần",
      imageUrl: "/uploads/seed-oc-huong.jpg",
    },
    {
      slug: "oc-mong-tay",
      name: "Ốc móng tay",
      description: "Nguyên liệu cho món xào rau muống và xào bơ tỏi.",
      unit: "phần",
      imageUrl: "/uploads/seed-oc-mong-tay.jpg",
    },
    {
      slug: "so-diep",
      name: "Sò điệp",
      description: "Sò điệp cỡ vừa dùng cho món nướng mỡ hành.",
      unit: "phần",
      imageUrl: "/uploads/seed-so-diep.jpg",
    },
    {
      slug: "so-huyet",
      name: "Sò huyết",
      description: "Pool dùng chung cho các món sò huyết trong ngày.",
      unit: "phần",
      imageUrl: "/uploads/seed-so-huyet.jpg",
    },
    {
      slug: "chem-chep",
      name: "Chem chép",
      description: "Nguồn chem chép cho món hấp Thái.",
      unit: "phần",
      imageUrl: "/uploads/seed-chem-chep.jpg",
    },
    {
      slug: "rau-muong",
      name: "Rau muống",
      description: "Rau muống tươi cho món xào tỏi ăn kèm.",
      unit: "dĩa",
      imageUrl: "/uploads/seed-rau-muong.jpg",
    },
    {
      slug: "banh-mi",
      name: "Bánh mì nướng",
      description: "Phần bánh mì giòn ăn kèm hải sản.",
      unit: "phần",
      imageUrl: "/uploads/seed-banh-mi.jpg",
    },
    {
      slug: "sting-vang",
      name: "Sting vàng",
      description: "Nước ngọt lon lạnh dùng tại bàn.",
      unit: "lon",
      imageUrl: "/uploads/seed-sting-vang.jpg",
    },
    {
      slug: "tra-tac",
      name: "Trà tắc",
      description: "Đồ uống pha sẵn theo ly.",
      unit: "ly",
      imageUrl: "/uploads/seed-tra-tac.jpg",
    },
    {
      slug: "nuoc-suoi",
      name: "Nước suối",
      description: "Nước suối chai lạnh.",
      unit: "chai",
      imageUrl: "/uploads/seed-nuoc-suoi.jpg",
    },
  ];

  for (const ingredient of ingredientSeeds) {
    await prisma.ingredient.upsert({
      where: { slug: ingredient.slug },
      update: ingredient,
      create: ingredient,
    });
  }

  const categoriesInDb = await prisma.category.findMany();
  const ingredientsInDb = await prisma.ingredient.findMany();

  const categoryIds = new Map(categoriesInDb.map((item) => [item.slug, item.id]));
  const ingredientIds = new Map(ingredientsInDb.map((item) => [item.slug, item.id]));

  const menuItemSeeds = [
    {
      slug: "oc-huong-rang-muoi",
      name: "Ốc hương rang muối",
      description: "Ốc hương rang giòn, vị mặn cay vừa phải, hợp đi bàn đông.",
      categorySlug: "oc-cac-loai",
      ingredientSlug: "oc-huong-tuoi",
      unit: "phần",
      basePrice: 129000,
      spicyLevel: 1,
      isFeatured: true,
      imageUrl: "/uploads/seed-oc-huong-rang-muoi.jpg",
      preparationTimeMin: 14,
    },
    {
      slug: "oc-huong-sot-trung-muoi",
      name: "Ốc hương sốt trứng muối",
      description: "Phiên bản béo mặn dùng chung nguồn ốc hương với món rang muối.",
      categorySlug: "oc-cac-loai",
      ingredientSlug: "oc-huong-tuoi",
      unit: "phần",
      basePrice: 139000,
      spicyLevel: 0,
      isFeatured: true,
      imageUrl: "/uploads/seed-oc-huong-trung-muoi.jpg",
      preparationTimeMin: 16,
    },
    {
      slug: "oc-mong-tay-xao-rau-muong",
      name: "Ốc móng tay xào rau muống",
      description: "Món bán đều cho khách gia đình, vị thơm và dễ ăn.",
      categorySlug: "oc-cac-loai",
      ingredientSlug: "oc-mong-tay",
      unit: "phần",
      basePrice: 99000,
      spicyLevel: 1,
      isFeatured: false,
      imageUrl: "/uploads/seed-oc-mong-tay-xao.jpg",
      preparationTimeMin: 12,
    },
    {
      slug: "so-diep-nuong-mo-hanh",
      name: "Sò điệp nướng mỡ hành",
      description: "Món nướng thơm béo, thường được gọi theo combo bàn nhậu.",
      categorySlug: "so-ngheu",
      ingredientSlug: "so-diep",
      unit: "phần",
      basePrice: 119000,
      spicyLevel: 0,
      isFeatured: true,
      imageUrl: "/uploads/seed-so-diep-mo-hanh.jpg",
      preparationTimeMin: 15,
    },
    {
      slug: "so-huyet-chay-toi",
      name: "Sò huyết cháy tỏi",
      description: "Sò huyết xào lửa lớn với tỏi phi, vị đậm và thơm.",
      categorySlug: "so-ngheu",
      ingredientSlug: "so-huyet",
      unit: "phần",
      basePrice: 109000,
      spicyLevel: 1,
      isFeatured: true,
      imageUrl: "/uploads/seed-so-huyet-chay-toi.jpg",
      preparationTimeMin: 13,
    },
    {
      slug: "so-huyet-nuong-moi",
      name: "Sò huyết nướng mọi",
      description: "Món nướng giữ vị ngọt tự nhiên, dùng chung pool sò huyết.",
      categorySlug: "so-ngheu",
      ingredientSlug: "so-huyet",
      unit: "phần",
      basePrice: 99000,
      spicyLevel: 0,
      isFeatured: false,
      imageUrl: "/uploads/seed-so-huyet-nuong-moi.jpg",
      preparationTimeMin: 11,
    },
    {
      slug: "chem-chep-hap-thai",
      name: "Chem chép hấp Thái",
      description: "Nước hấp chua cay, hợp khách thích món nước.",
      categorySlug: "so-ngheu",
      ingredientSlug: "chem-chep",
      unit: "phần",
      basePrice: 89000,
      spicyLevel: 2,
      isFeatured: false,
      imageUrl: "/uploads/seed-chem-chep-thai.jpg",
      preparationTimeMin: 14,
    },
    {
      slug: "rau-muong-xao-toi",
      name: "Rau muống xào tỏi",
      description: "Món kèm bán chạy để cân vị cho bàn nhiều hải sản.",
      categorySlug: "mon-an-kem",
      ingredientSlug: "rau-muong",
      unit: "dĩa",
      basePrice: 45000,
      spicyLevel: 0,
      isFeatured: false,
      imageUrl: "/uploads/seed-rau-muong-xao-toi.jpg",
      preparationTimeMin: 7,
    },
    {
      slug: "banh-mi-nuong-muoi-ot",
      name: "Bánh mì nướng muối ớt",
      description: "Ăn kèm với sốt và nước món, dễ bán thêm.",
      categorySlug: "mon-an-kem",
      ingredientSlug: "banh-mi",
      unit: "phần",
      basePrice: 25000,
      spicyLevel: 1,
      isFeatured: false,
      imageUrl: "/uploads/seed-banh-mi-muoi-ot.jpg",
      preparationTimeMin: 5,
    },
    {
      slug: "sting-vang",
      name: "Sting vàng",
      description: "Nước ngọt lon lạnh phục vụ nhanh tại bàn.",
      categorySlug: "nuoc-uong",
      ingredientSlug: "sting-vang",
      unit: "lon",
      basePrice: 18000,
      spicyLevel: 0,
      isFeatured: false,
      imageUrl: "/uploads/seed-sting-vang.jpg",
      preparationTimeMin: 1,
    },
    {
      slug: "tra-tac",
      name: "Trà tắc",
      description: "Ly trà tắc mát, hợp món cay và món nướng.",
      categorySlug: "nuoc-uong",
      ingredientSlug: "tra-tac",
      unit: "ly",
      basePrice: 22000,
      spicyLevel: 0,
      isFeatured: true,
      imageUrl: "/uploads/seed-tra-tac.jpg",
      preparationTimeMin: 3,
    },
    {
      slug: "nuoc-suoi",
      name: "Nước suối",
      description: "Nước suối chai lạnh cho khách đi nhóm và giao hàng.",
      categorySlug: "nuoc-uong",
      ingredientSlug: "nuoc-suoi",
      unit: "chai",
      basePrice: 12000,
      spicyLevel: 0,
      isFeatured: false,
      imageUrl: "/uploads/seed-nuoc-suoi.jpg",
      preparationTimeMin: 1,
    },
  ];

  for (const item of menuItemSeeds) {
    const categoryId = categoryIds.get(item.categorySlug);
    const ingredientId = ingredientIds.get(item.ingredientSlug);
    if (!categoryId || !ingredientId) {
      continue;
    }

    await prisma.menuItem.upsert({
      where: { slug: item.slug },
      update: {
        name: item.name,
        description: item.description,
        unit: item.unit,
        spicyLevel: item.spicyLevel,
        imageUrl: item.imageUrl,
        basePrice: money(item.basePrice),
        status: MenuItemStatus.ACTIVE,
        isFeatured: item.isFeatured,
        isAvailable: true,
        preparationTimeMin: item.preparationTimeMin,
        categoryId,
        createdById: adminId,
        ingredientPresets: {
          deleteMany: {},
          create: [
            {
              ingredientId,
              consumeQuantity: money(1),
              sortOrder: 0,
            },
          ],
        },
      },
      create: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        unit: item.unit,
        spicyLevel: item.spicyLevel,
        imageUrl: item.imageUrl,
        basePrice: money(item.basePrice),
        status: MenuItemStatus.ACTIVE,
        isFeatured: item.isFeatured,
        isAvailable: true,
        preparationTimeMin: item.preparationTimeMin,
        categoryId,
        createdById: adminId,
        ingredientPresets: {
          create: [
            {
              ingredientId,
              consumeQuantity: money(1),
              sortOrder: 0,
            },
          ],
        },
      },
    });
  }

  const menuItemsInDb = await prisma.menuItem.findMany();
  for (const item of menuItemsInDb) {
    await prisma.menuItemPrice.upsert({
      where: {
        menuItemId_effectiveFrom: {
          menuItemId: item.id,
          effectiveFrom: today,
        },
      },
      update: {
        price: item.basePrice,
        note: "Giá mẫu seed admin orders",
      },
      create: {
        menuItemId: item.id,
        price: item.basePrice,
        effectiveFrom: today,
        note: "Giá mẫu seed admin orders",
      },
    });
  }

  return {
    menuItemsBySlug: new Map(menuItemsInDb.map((item) => [item.slug, item])),
    ingredientsBySlug: new Map(ingredientsInDb.map((item) => [item.slug, item])),
  };
}

async function seedServiceDay(
  input: ServiceDayInput,
  adminId: number,
  users: Record<SeedUserKey, Awaited<ReturnType<typeof seedUsers>>[SeedUserKey]>,
  menuItemsBySlug: Map<string, any>,
  ingredientsBySlug: Map<string, any>
) {
  const code = `MENU-${dateKey(input.day)}`;

  const dailyMenu = await prisma.dailyMenu.upsert({
    where: { code },
    update: {
      title: input.title,
      serviceDate: input.day,
      status: input.status,
      note: input.note,
      bannerText: input.bannerText,
      createdById: adminId,
    },
    create: {
      code,
      title: input.title,
      serviceDate: input.day,
      status: input.status,
      note: input.note,
      bannerText: input.bannerText,
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

  const stockPoolTemplates = [
    { stockSlug: "oc-huong-tuoi", quantity: 10, note: "Pool dùng chung cho hai món ốc hương." },
    { stockSlug: "oc-mong-tay", quantity: 7, note: "Pool riêng cho món ốc móng tay." },
    { stockSlug: "so-diep", quantity: 8, note: "Pool riêng cho sò điệp nướng mỡ hành." },
    { stockSlug: "so-huyet", quantity: 9, note: "Pool chia sẻ cho hai món sò huyết." },
    { stockSlug: "chem-chep", quantity: 6, note: "Pool riêng cho chem chép hấp Thái." },
    { stockSlug: "rau-muong", quantity: 8, note: "Pool rau dùng cho món ăn kèm." },
    { stockSlug: "banh-mi", quantity: 12, note: "Pool bánh mì nướng bán thêm theo bàn." },
    { stockSlug: "sting-vang", quantity: 30, note: "Pool đồ uống lon lạnh." },
    { stockSlug: "tra-tac", quantity: 20, note: "Pool trà tắc theo ly." },
    { stockSlug: "nuoc-suoi", quantity: 24, note: "Pool nước suối chai." },
  ];

  const poolIdBySlug = new Map<string, number>();
  for (const pool of stockPoolTemplates) {
    const ingredient = ingredientsBySlug.get(pool.stockSlug);
    if (!ingredient) {
      continue;
    }

    const createdPool = await prisma.dailyStockPool.create({
      data: {
        dailyMenuId: dailyMenu.id,
        ingredientId: ingredient.id,
        label: ingredient.name,
        quantity: money(pool.quantity),
        soldQuantity: money(0),
        note: pool.note,
      },
    });
    poolIdBySlug.set(pool.stockSlug, createdPool.id);
  }

  const offerTemplates = [
    { menuItemSlug: "oc-huong-rang-muoi", stockSlug: "oc-huong-tuoi", overridePrice: 129000, highlightLabel: "Bán chạy" },
    { menuItemSlug: "oc-huong-sot-trung-muoi", stockSlug: "oc-huong-tuoi", overridePrice: 139000, highlightLabel: "Đậm vị" },
    { menuItemSlug: "oc-mong-tay-xao-rau-muong", stockSlug: "oc-mong-tay", overridePrice: 99000, highlightLabel: "Dễ gọi" },
    { menuItemSlug: "so-diep-nuong-mo-hanh", stockSlug: "so-diep", overridePrice: 119000, highlightLabel: "Mỡ hành" },
    { menuItemSlug: "so-huyet-chay-toi", stockSlug: "so-huyet", overridePrice: 109000, highlightLabel: "Thơm tỏi" },
    { menuItemSlug: "so-huyet-nuong-moi", stockSlug: "so-huyet", overridePrice: 99000, highlightLabel: "Ngọt thịt" },
    { menuItemSlug: "chem-chep-hap-thai", stockSlug: "chem-chep", overridePrice: 89000, highlightLabel: "Chua cay" },
    { menuItemSlug: "rau-muong-xao-toi", stockSlug: "rau-muong", overridePrice: 45000, highlightLabel: "Ăn kèm" },
    { menuItemSlug: "banh-mi-nuong-muoi-ot", stockSlug: "banh-mi", overridePrice: 25000, highlightLabel: "Gọi thêm" },
    { menuItemSlug: "sting-vang", stockSlug: "sting-vang", overridePrice: 18000, highlightLabel: "Lon lạnh" },
    { menuItemSlug: "tra-tac", stockSlug: "tra-tac", overridePrice: 22000, highlightLabel: "Mát vị" },
    { menuItemSlug: "nuoc-suoi", stockSlug: "nuoc-suoi", overridePrice: 12000, highlightLabel: "Phục vụ nhanh" },
  ];

  const offerMap = new Map<
    string,
    {
      menuItemId: number;
      dailyMenuItemId: number;
      itemNameSnapshot: string;
      unitPrice: number;
      stockSlug: string;
    }
  >();

  for (const offer of offerTemplates) {
    const menuItem = menuItemsBySlug.get(offer.menuItemSlug);
    const stockPoolId = poolIdBySlug.get(offer.stockSlug);
    if (!menuItem || !stockPoolId) {
      continue;
    }

    const createdOffer = await prisma.dailyMenuItem.create({
      data: {
        dailyMenuId: dailyMenu.id,
        menuItemId: menuItem.id,
        overridePrice: money(offer.overridePrice),
        isAvailable: true,
        highlightLabel: offer.highlightLabel,
        stockLinks: {
          create: {
            dailyStockPoolId: stockPoolId,
            consumeQuantity: money(1),
          },
        },
      },
    });

    offerMap.set(offer.menuItemSlug, {
      menuItemId: menuItem.id,
      dailyMenuItemId: createdOffer.id,
      itemNameSnapshot: menuItem.name,
      unitPrice: offer.overridePrice,
      stockSlug: offer.stockSlug,
    });
  }

  const soldQuantityByStockSlug = new Map<string, number>();

  for (const spec of input.orderSpecs) {
    const customer = spec.customerKey ? users[spec.customerKey] : null;
    const createdBy = users[spec.createdByKey];
    const assignedStaff = spec.assignedStaffKey ? users[spec.assignedStaffKey] : null;

    const lines = spec.items
      .map((item) => {
        const offer = offerMap.get(item.menuItemSlug);
        if (!offer) {
          return null;
        }

        if (shouldCountTowardsSoldQuantity(spec.status)) {
          soldQuantityByStockSlug.set(
            offer.stockSlug,
            (soldQuantityByStockSlug.get(offer.stockSlug) || 0) + item.quantity
          );
        }

        return {
          menuItemId: offer.menuItemId,
          dailyMenuItemId: offer.dailyMenuItemId,
          itemNameSnapshot: offer.itemNameSnapshot,
          unitPrice: money(offer.unitPrice),
          quantity: item.quantity,
          lineTotal: money(offer.unitPrice * item.quantity),
          note: item.note,
        };
      })
      .filter(Boolean) as Array<{
      menuItemId: number;
      dailyMenuItemId: number;
      itemNameSnapshot: string;
      unitPrice: Prisma.Decimal;
      quantity: number;
      lineTotal: Prisma.Decimal;
      note?: string;
    }>;

    const subtotal = lines.reduce((sum, item) => sum + Number(item.lineTotal), 0);
    const serviceFee = spec.serviceFee ?? 0;
    const discountAmount = spec.discountAmount ?? 0;
    const totalAmount = subtotal + serviceFee - discountAmount;

    await prisma.order.create({
      data: {
        orderNumber: `OBT-${dateKey(input.day).replace(/-/g, "")}-${spec.code}`,
        source: spec.source,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        paymentMethod: spec.paymentMethod,
        tableLabel: spec.tableLabel,
        guestCount: spec.guestCount,
        guestName: spec.guestName ?? customer?.fullName ?? null,
        guestPhone: spec.guestPhone ?? customer?.phone ?? null,
        note: spec.note,
        internalNote: spec.internalNote,
        subtotal: money(subtotal),
        serviceFee: money(serviceFee),
        discountAmount: money(discountAmount),
        totalAmount: money(totalAmount),
        createdById: createdBy.id,
        assignedStaffId: assignedStaff?.id,
        customerId: customer?.id,
        dailyMenuId: dailyMenu.id,
        createdAt: spec.createdAt,
        confirmedAt: spec.confirmedAt,
        completedAt: spec.completedAt,
        items: {
          create: lines,
        },
      },
    });
  }

  for (const [stockSlug, soldQuantity] of soldQuantityByStockSlug.entries()) {
    const poolId = poolIdBySlug.get(stockSlug);
    if (!poolId) {
      continue;
    }

    await prisma.dailyStockPool.update({
      where: { id: poolId },
      data: {
        soldQuantity: money(soldQuantity),
      },
    });
  }
}

async function seedOrders(
  users: Record<SeedUserKey, Awaited<ReturnType<typeof seedUsers>>[SeedUserKey]>,
  adminId: number,
  menuItemsBySlug: Map<string, any>,
  ingredientsBySlug: Map<string, any>
) {
  const today = startOfDay();
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  await seedServiceDay(
    {
      day: today,
      status: DailyMenuStatus.PUBLISHED,
      title: "Thực đơn hải sản hôm nay",
      note: "Menu ngày cho luồng quán nhỏ: đa số khách đặt trước, admin xác nhận đơn, sửa món rồi mới thu tiền ở cuối.",
      bannerText: "Ốc hương và sò huyết hôm nay dùng chung pool để kiểm tra tồn kho khi thêm bớt món trong đơn.",
      orderSpecs: [
        {
          code: "101",
          createdByKey: "lanAnh",
          assignedStaffKey: "staffMai",
          customerKey: "lanAnh",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          guestCount: 2,
          note: "Ít cay, giữ nóng giúp bàn.",
          createdAt: atTime(today, 11, 5),
          items: [
            { menuItemSlug: "oc-huong-rang-muoi", quantity: 1 },
            { menuItemSlug: "sting-vang", quantity: 2 },
          ],
        },
        {
          code: "102",
          createdByKey: "staffMai",
          assignedStaffKey: "staffMai",
          source: OrderSource.STAFF_POS,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Sân 02",
          guestCount: 3,
          guestName: "Anh Bảo",
          guestPhone: "0912233445",
          note: "Bàn khách gọi thêm nước sau.",
          serviceFee: 5000,
          createdAt: atTime(today, 11, 35),
          confirmedAt: atTime(today, 11, 42),
          items: [
            { menuItemSlug: "so-huyet-chay-toi", quantity: 1 },
            { menuItemSlug: "banh-mi-nuong-muoi-ot", quantity: 1 },
            { menuItemSlug: "tra-tac", quantity: 1 },
          ],
        },
        {
          code: "103",
          createdByKey: "admin",
          assignedStaffKey: "staffKhanh",
          customerKey: "minhChau",
          source: OrderSource.ADMIN_POS,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Mang đi 01",
          note: "Khách văn phòng lấy trước 12h15.",
          internalNote: "Ưu tiên ra món rau trước.",
          createdAt: atTime(today, 12, 0),
          confirmedAt: atTime(today, 12, 3),
          items: [
            { menuItemSlug: "oc-mong-tay-xao-rau-muong", quantity: 1 },
            { menuItemSlug: "rau-muong-xao-toi", quantity: 1 },
            { menuItemSlug: "nuoc-suoi", quantity: 2 },
          ],
        },
        {
          code: "104",
          createdByKey: "quocPhuc",
          assignedStaffKey: "staffMai",
          customerKey: "quocPhuc",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.TRANSFER,
          tableLabel: "Phòng VIP",
          guestCount: 4,
          note: "Khách VIP yêu cầu mang món cùng lúc.",
          discountAmount: 10000,
          createdAt: atTime(today, 13, 10),
          confirmedAt: atTime(today, 13, 18),
          completedAt: atTime(today, 14, 5),
          items: [
            { menuItemSlug: "oc-huong-sot-trung-muoi", quantity: 1 },
            { menuItemSlug: "tra-tac", quantity: 2 },
          ],
        },
        {
          code: "105",
          createdByKey: "staffKhanh",
          assignedStaffKey: "staffKhanh",
          source: OrderSource.STAFF_POS,
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CASH,
          tableLabel: "Hiên 05",
          guestCount: 2,
          guestName: "Cô Hồng Vân",
          guestPhone: "0933456677",
          note: "Thêm khăn lạnh cho bàn này.",
          createdAt: atTime(today, 18, 20),
          confirmedAt: atTime(today, 18, 28),
          items: [
            { menuItemSlug: "so-diep-nuong-mo-hanh", quantity: 1 },
            { menuItemSlug: "nuoc-suoi", quantity: 2 },
          ],
        },
        {
          code: "106",
          createdByKey: "anNhi",
          assignedStaffKey: "staffMai",
          customerKey: "anNhi",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.TRANSFER,
          tableLabel: "Bàn Hẻm 06",
          guestCount: 3,
          note: "Khách du lịch thích món chua cay.",
          createdAt: atTime(today, 19, 5),
          confirmedAt: atTime(today, 19, 12),
          completedAt: atTime(today, 20, 0),
          items: [
            { menuItemSlug: "chem-chep-hap-thai", quantity: 1 },
            { menuItemSlug: "so-huyet-nuong-moi", quantity: 1 },
            { menuItemSlug: "sting-vang", quantity: 1 },
          ],
        },
        {
          code: "107",
          createdByKey: "admin",
          assignedStaffKey: "staffKhanh",
          source: OrderSource.ADMIN_POS,
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Đặt trước đoàn",
          guestCount: 6,
          guestName: "Đoàn khách Hà Nội",
          guestPhone: "0988776655",
          note: "Khách đổi lịch do kẹt xe.",
          internalNote: "Giữ liên hệ để dời qua ngày mai.",
          createdAt: atTime(today, 20, 10),
          confirmedAt: atTime(today, 20, 18),
          items: [
            { menuItemSlug: "oc-huong-rang-muoi", quantity: 2 },
            { menuItemSlug: "so-diep-nuong-mo-hanh", quantity: 2 },
          ],
        },
      ],
    },
    adminId,
    users,
    menuItemsBySlug,
    ingredientsBySlug
  );

  await seedServiceDay(
    {
      day: tomorrow,
      status: DailyMenuStatus.PUBLISHED,
      title: "Thực đơn hải sản ngày mai",
      note: "Menu ngày mai vẫn mở sẵn để admin đổi ngày và thử thêm món vào đơn đang xử lý.",
      bannerText: "Dữ liệu ngày mai giữ tồn kho thoáng hơn để thao tác cộng món, giảm món và lưu đơn dễ kiểm tra.",
      orderSpecs: [
        {
          code: "301",
          createdByKey: "staffMai",
          assignedStaffKey: "staffMai",
          source: OrderSource.STAFF_POS,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Hẻm 01",
          guestCount: 2,
          guestName: "Anh Đức",
          guestPhone: "0901222333",
          note: "Giữ chỗ bàn sát cửa cho khách đi sớm.",
          createdAt: atTime(tomorrow, 18, 10),
          confirmedAt: atTime(tomorrow, 18, 15),
          items: [
            { menuItemSlug: "oc-huong-rang-muoi", quantity: 1 },
            { menuItemSlug: "tra-tac", quantity: 2 },
          ],
        },
        {
          code: "302",
          createdByKey: "quocPhuc",
          assignedStaffKey: "staffKhanh",
          customerKey: "quocPhuc",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Sân 03",
          guestCount: 4,
          note: "Khách nói có thể gọi thêm món nướng khi tới quán.",
          createdAt: atTime(tomorrow, 19, 0),
          confirmedAt: atTime(tomorrow, 19, 8),
          items: [
            { menuItemSlug: "so-huyet-chay-toi", quantity: 1 },
            { menuItemSlug: "banh-mi-nuong-muoi-ot", quantity: 1 },
          ],
        },
      ],
    },
    adminId,
    users,
    menuItemsBySlug,
    ingredientsBySlug
  );

  await seedServiceDay(
    {
      day: yesterday,
      status: DailyMenuStatus.ARCHIVED,
      title: "Thực đơn hải sản hôm qua",
      note: "Menu lưu lại để thử bộ lọc theo ngày và lịch sử đơn hàng sau khi quán đã chốt ca.",
      bannerText: "Dữ liệu hôm qua dùng để kiểm tra chọn ngày khác và xem các đơn đã hoàn tất.",
      orderSpecs: [
        {
          code: "201",
          createdByKey: "lanAnh",
          assignedStaffKey: "staffMai",
          customerKey: "lanAnh",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.TRANSFER,
          tableLabel: "Bàn Hẻm 03",
          guestCount: 2,
          note: "Khách quay lại sau giờ tan làm.",
          createdAt: atTime(yesterday, 18, 15),
          confirmedAt: atTime(yesterday, 18, 22),
          completedAt: atTime(yesterday, 19, 10),
          items: [
            { menuItemSlug: "so-huyet-chay-toi", quantity: 1 },
            { menuItemSlug: "tra-tac", quantity: 2 },
          ],
        },
        {
          code: "202",
          createdByKey: "staffMai",
          assignedStaffKey: "staffKhanh",
          source: OrderSource.STAFF_POS,
          status: OrderStatus.COMPLETED,
          paymentStatus: PaymentStatus.PAID,
          paymentMethod: PaymentMethod.CASH,
          tableLabel: "Sân 01",
          guestCount: 4,
          guestName: "Anh Hải",
          guestPhone: "0908111222",
          serviceFee: 10000,
          createdAt: atTime(yesterday, 19, 25),
          confirmedAt: atTime(yesterday, 19, 32),
          completedAt: atTime(yesterday, 20, 12),
          items: [
            { menuItemSlug: "oc-mong-tay-xao-rau-muong", quantity: 1 },
            { menuItemSlug: "sting-vang", quantity: 2 },
            { menuItemSlug: "banh-mi-nuong-muoi-ot", quantity: 1 },
          ],
        },
        {
          code: "203",
          createdByKey: "minhChau",
          assignedStaffKey: "staffMai",
          customerKey: "minhChau",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.CANCELLED,
          paymentStatus: PaymentStatus.UNPAID,
          guestCount: 1,
          note: "Khách đổi địa chỉ giao hàng nên hủy.",
          createdAt: atTime(yesterday, 21, 0),
          items: [{ menuItemSlug: "chem-chep-hap-thai", quantity: 1 }],
        },
      ],
    },
    adminId,
    users,
    menuItemsBySlug,
    ingredientsBySlug
  );
}

async function main() {
  const users = await seedUsers();
  const admin = users.admin;
  const { menuItemsBySlug, ingredientsBySlug } = await seedCatalog(admin.id);

  await seedOrders(users, admin.id, menuItemsBySlug, ingredientsBySlug);
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
