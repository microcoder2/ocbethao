import bcrypt from "bcryptjs";
import {
  CustomerType,
  DailyMenuStatus,
  MenuItemStatus,
  OrderItemStatus,
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
  arrivalAt?: Date;
  serviceFee?: number;
  discountAmount?: number;
  createdAt: Date;
  confirmedAt?: Date;
  completedAt?: Date;
  items: Array<{
    menuItemSlug: string;
    quantity: number;
    note?: string;
    status?: OrderItemStatus;
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
  return status !== OrderStatus.CANCELLED && status !== OrderStatus.PENDING;
}

function getDefaultItemStatus(status: OrderStatus): OrderItemStatus {
  if (status === OrderStatus.COMPLETED) return OrderItemStatus.READY;
  if (status === OrderStatus.CANCELLED) return OrderItemStatus.CANCELLED;
  return OrderItemStatus.WAITING;
}

function buildSeedStageData(quantity: number, status: OrderItemStatus) {
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

async function cleanDatabase() {
  await prisma.orderItem.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.dailyMenuItemStock.deleteMany({});
  await prisma.dailyMenuItem.deleteMany({});
  await prisma.dailyStockPool.deleteMany({});
  await prisma.dailyMenu.deleteMany({});
  await prisma.menuItemIngredientPreset.deleteMany({});
  await prisma.menuItemPrice.deleteMany({});
  await prisma.menuItem.deleteMany({});
  await prisma.ingredient.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.userSession.deleteMany({});
  await prisma.authChallenge.deleteMany({});
  await prisma.userAuthIdentity.deleteMany({});
  await prisma.user.deleteMany({});
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
    await prisma.user.create({
      data: {
        fullName: profile.fullName,
        username: profile.username,
        phone: profile.phone,
        email: profile.email,
        password,
        role: profile.role,
        customerType: profile.customerType,
        preferredAuthProvider: profile.preferredAuthProvider,
        isActive: true,
      },
    });
  }

  const users = await prisma.user.findMany({
    where: {
      OR: Object.values(profiles).map((p) =>
        p.email ? { email: p.email } : { phone: p.phone as string }
      ),
    },
  });

  const byKey = new Map<SeedUserKey, (typeof users)[number]>();
  for (const [key, profile] of Object.entries(profiles) as Array<[SeedUserKey, SeedUserProfile]>) {
    const user = users.find((u) =>
      profile.email ? u.email === profile.email : u.phone === profile.phone
    );
    if (user) byKey.set(key, user);
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
      description: "Các món ốc chủ lực của quán — ốc hương, ốc tỏi, ốc gai, ốc mỡ, ốc gạo.",
      sortOrder: 1,
    },
    {
      slug: "ghe-cua",
      name: "Ghẹ & Cua",
      description: "Càng ghẹ to, càng ghẹ nhỏ — chiên giòn, xào hay nướng.",
      sortOrder: 2,
    },
    {
      slug: "so-hao-ngheu",
      name: "Sò, Hào & Nghêu",
      description: "Sò lông, sò huyết, sò lụa, hào, nghêu, chem chép, ngao 2 còi.",
      sortOrder: 3,
    },
    {
      slug: "mon-an-kem",
      name: "Món ăn kèm",
      description: "Xào mì, xào rau muống, bánh mì — ăn kèm hoặc upsell thêm.",
      sortOrder: 4,
    },
    {
      slug: "nuoc-uong",
      name: "Nước uống",
      description: "Coca, Pepsi, Sting, trà đá — phục vụ tại bàn.",
      sortOrder: 5,
    },
  ];

  for (const cat of categories) {
    await prisma.category.create({ data: cat });
  }

  const ingredientSeeds = [
    // Ốc
    { slug: "oc-huong-to",   name: "Ốc hương to",   unit: "phần" },
    { slug: "oc-huong-nho",  name: "Ốc hương nhỏ",  unit: "phần" },
    { slug: "oc-toi-to",     name: "Ốc tỏi to",     unit: "phần" },
    { slug: "oc-toi-nho",    name: "Ốc tỏi nhỏ",    unit: "phần" },
    { slug: "oc-gai",        name: "Ốc gai",         unit: "phần" },
    { slug: "oc-mo",         name: "Ốc mỡ",          unit: "phần" },
    { slug: "oc-gao",        name: "Ốc gạo",         unit: "phần" },
    // Ghẹ
    { slug: "cang-ghe-to",   name: "Càng ghẹ to",   unit: "phần" },
    { slug: "cang-ghe-nho",  name: "Càng ghẹ nhỏ",  unit: "phần" },
    // Sò, hào, nghêu
    { slug: "so-long",       name: "Sò lông",        unit: "phần" },
    { slug: "so-huyet",      name: "Sò huyết",       unit: "phần" },
    { slug: "so-lua",        name: "Sò lụa",         unit: "phần" },
    { slug: "hao",           name: "Hào",            unit: "phần" },
    { slug: "ngheu",         name: "Nghêu",          unit: "phần" },
    { slug: "chem-chep",     name: "Chem chép",      unit: "phần" },
    { slug: "ngao-2-coi",    name: "Ngao 2 còi",     unit: "phần" },
    // Kèm
    { slug: "mi",            name: "Mì xào",         unit: "dĩa"  },
    { slug: "rau-muong",     name: "Rau muống",      unit: "dĩa"  },
    { slug: "banh-mi",       name: "Bánh mì nướng",  unit: "phần" },
    // Nước
    { slug: "coca",          name: "Coca lon",       unit: "lon"  },
    { slug: "pepsi",         name: "Pepsi lon",      unit: "lon"  },
    { slug: "sting",         name: "Sting lon",      unit: "lon"  },
    { slug: "tra-da",        name: "Trà đá",         unit: "ly"   },
  ];

  for (const ing of ingredientSeeds) {
    await prisma.ingredient.create({ data: { ...ing, isActive: true } });
  }

  const categoriesInDb  = await prisma.category.findMany();
  const ingredientsInDb = await prisma.ingredient.findMany();
  const categoryIds     = new Map(categoriesInDb.map((c) => [c.slug, c.id]));
  const ingredientIds   = new Map(ingredientsInDb.map((i) => [i.slug, i.id]));

  const menuItemSeeds = [
    // ── Ốc hương to ──────────────────────────────────────────────
    {
      slug: "oc-huong-to-rang-muoi",
      name: "Ốc hương to rang muối",
      description: "Ốc hương cỡ lớn rang giòn thơm, vị mặn cay vừa phải.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-huong-to",
      unit: "phần", basePrice: 149000, spicyLevel: 1, isFeatured: true, preparationTimeMin: 14,
    },
    {
      slug: "oc-huong-to-xao-bo-toi",
      name: "Ốc hương to xào bơ tỏi",
      description: "Ốc hương cỡ lớn xào bơ tỏi béo thơm, nước sốt đậm đà.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-huong-to",
      unit: "phần", basePrice: 159000, spicyLevel: 0, isFeatured: true, preparationTimeMin: 13,
    },
    {
      slug: "oc-huong-to-sot-trung-muoi",
      name: "Ốc hương to sốt trứng muối",
      description: "Ốc hương cỡ lớn phủ sốt trứng muối béo mặn đặc trưng.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-huong-to",
      unit: "phần", basePrice: 169000, spicyLevel: 0, isFeatured: true, preparationTimeMin: 16,
    },
    // ── Ốc hương nhỏ ─────────────────────────────────────────────
    {
      slug: "oc-huong-nho-rang-muoi",
      name: "Ốc hương nhỏ rang muối",
      description: "Ốc hương cỡ vừa rang muối, dễ ăn và vừa túi tiền.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-huong-nho",
      unit: "phần", basePrice: 99000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 12,
    },
    {
      slug: "oc-huong-nho-xao-bo-toi",
      name: "Ốc hương nhỏ xào bơ tỏi",
      description: "Ốc hương cỡ vừa xào bơ tỏi thơm ngon.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-huong-nho",
      unit: "phần", basePrice: 109000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 11,
    },
    // ── Ốc tỏi to ────────────────────────────────────────────────
    {
      slug: "oc-toi-to-nuong",
      name: "Ốc tỏi to nướng",
      description: "Ốc tỏi cỡ lớn nướng than, thịt chắc ngọt, vị tỏi thơm.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-toi-to",
      unit: "phần", basePrice: 129000, spicyLevel: 0, isFeatured: true, preparationTimeMin: 15,
    },
    {
      slug: "oc-toi-to-xao",
      name: "Ốc tỏi to xào",
      description: "Ốc tỏi cỡ lớn xào sả ớt hoặc xào bơ tùy chọn.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-toi-to",
      unit: "phần", basePrice: 129000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 12,
    },
    // ── Ốc tỏi nhỏ ───────────────────────────────────────────────
    {
      slug: "oc-toi-nho-nuong",
      name: "Ốc tỏi nhỏ nướng",
      description: "Ốc tỏi cỡ vừa nướng mỡ hành, dễ ăn phù hợp mọi bàn.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-toi-nho",
      unit: "phần", basePrice: 89000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 13,
    },
    {
      slug: "oc-toi-nho-xao",
      name: "Ốc tỏi nhỏ xào",
      description: "Ốc tỏi cỡ vừa xào tỏi ớt đơn giản, giá hợp lý.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-toi-nho",
      unit: "phần", basePrice: 89000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 10,
    },
    // ── Ốc gai ───────────────────────────────────────────────────
    {
      slug: "oc-gai-xao",
      name: "Ốc gai xào",
      description: "Ốc gai xào sả ớt, thịt dai ngọt, hợp nhóm bạn nhậu.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-gai",
      unit: "phần", basePrice: 69000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 10,
    },
    // ── Ốc mỡ ────────────────────────────────────────────────────
    {
      slug: "oc-mo-xao",
      name: "Ốc mỡ xào",
      description: "Ốc mỡ xào tỏi bơ, béo ngậy và dễ ăn.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-mo",
      unit: "phần", basePrice: 59000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 9,
    },
    // ── Ốc gạo ───────────────────────────────────────────────────
    {
      slug: "oc-gao-xao",
      name: "Ốc gạo xào",
      description: "Ốc gạo xào gừng sả, giá bình dân ăn chơi bữa nhẹ.",
      categorySlug: "oc-cac-loai", ingredientSlug: "oc-gao",
      unit: "phần", basePrice: 49000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 8,
    },
    // ── Càng ghẹ to ──────────────────────────────────────────────
    {
      slug: "cang-ghe-to-xao",
      name: "Càng ghẹ to xào",
      description: "Càng ghẹ cỡ lớn xào me hoặc xào bơ tỏi theo yêu cầu.",
      categorySlug: "ghe-cua", ingredientSlug: "cang-ghe-to",
      unit: "phần", basePrice: 169000, spicyLevel: 1, isFeatured: true, preparationTimeMin: 16,
    },
    {
      slug: "cang-ghe-to-nuong",
      name: "Càng ghẹ to nướng",
      description: "Càng ghẹ cỡ lớn nướng than hoa, thịt chắc giữ vị ngọt tự nhiên.",
      categorySlug: "ghe-cua", ingredientSlug: "cang-ghe-to",
      unit: "phần", basePrice: 179000, spicyLevel: 0, isFeatured: true, preparationTimeMin: 18,
    },
    // ── Càng ghẹ nhỏ ─────────────────────────────────────────────
    {
      slug: "cang-ghe-nho-xao",
      name: "Càng ghẹ nhỏ xào",
      description: "Càng ghẹ cỡ vừa xào me chua ngọt, vừa miệng.",
      categorySlug: "ghe-cua", ingredientSlug: "cang-ghe-nho",
      unit: "phần", basePrice: 119000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 14,
    },
    {
      slug: "cang-ghe-nho-nuong",
      name: "Càng ghẹ nhỏ nướng",
      description: "Càng ghẹ cỡ vừa nướng mỡ hành, giá hợp lý cho bàn đông.",
      categorySlug: "ghe-cua", ingredientSlug: "cang-ghe-nho",
      unit: "phần", basePrice: 119000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 15,
    },
    // ── Sò lông ──────────────────────────────────────────────────
    {
      slug: "so-long-nuong-mo-hanh",
      name: "Sò lông nướng mỡ hành",
      description: "Sò lông nướng than phủ mỡ hành xanh, thơm bùi.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "so-long",
      unit: "phần", basePrice: 89000, spicyLevel: 0, isFeatured: true, preparationTimeMin: 13,
    },
    {
      slug: "so-long-xao",
      name: "Sò lông xào",
      description: "Sò lông xào tỏi ớt tươi, vị đậm nhanh ra món.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "so-long",
      unit: "phần", basePrice: 79000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 10,
    },
    // ── Sò huyết ─────────────────────────────────────────────────
    {
      slug: "so-huyet-nuong-moi",
      name: "Sò huyết nướng mọi",
      description: "Sò huyết nướng than giữ vị ngọt máu tự nhiên.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "so-huyet",
      unit: "phần", basePrice: 89000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 11,
    },
    {
      slug: "so-huyet-chay-toi",
      name: "Sò huyết cháy tỏi",
      description: "Sò huyết xào lửa to với tỏi phi, vị đậm thơm đặc trưng.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "so-huyet",
      unit: "phần", basePrice: 99000, spicyLevel: 1, isFeatured: true, preparationTimeMin: 12,
    },
    // ── Sò lụa ───────────────────────────────────────────────────
    {
      slug: "so-lua-nuong",
      name: "Sò lụa nướng",
      description: "Sò lụa nướng mỡ hành, thịt mịn ngọt dịu.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "so-lua",
      unit: "phần", basePrice: 79000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 12,
    },
    {
      slug: "so-lua-xao",
      name: "Sò lụa xào",
      description: "Sò lụa xào gừng hành, nước sốt ít và vị nhẹ.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "so-lua",
      unit: "phần", basePrice: 69000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 9,
    },
    // ── Hào ──────────────────────────────────────────────────────
    {
      slug: "hao-nuong-pho-mai",
      name: "Hào nướng phô mai",
      description: "Hào tươi nướng phủ phô mai tan chảy, béo ngậy cao cấp.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "hao",
      unit: "phần", basePrice: 109000, spicyLevel: 0, isFeatured: true, preparationTimeMin: 15,
    },
    {
      slug: "hao-nuong-mo-hanh",
      name: "Hào nướng mỡ hành",
      description: "Hào tươi nướng than phủ mỡ hành truyền thống.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "hao",
      unit: "phần", basePrice: 99000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 13,
    },
    // ── Nghêu ────────────────────────────────────────────────────
    {
      slug: "ngheu-hap-sa",
      name: "Nghêu hấp sả",
      description: "Nghêu hấp sả gừng, nước hấp thơm uống được luôn.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "ngheu",
      unit: "phần", basePrice: 79000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 10,
    },
    {
      slug: "ngheu-xao",
      name: "Nghêu xào",
      description: "Nghêu xào tỏi ớt hoặc xào me theo yêu cầu bàn.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "ngheu",
      unit: "phần", basePrice: 69000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 9,
    },
    // ── Chem chép ────────────────────────────────────────────────
    {
      slug: "chem-chep-hap-thai",
      name: "Chem chép hấp Thái",
      description: "Chem chép hấp nước Thái chua cay, hợp khách thích món nước.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "chem-chep",
      unit: "phần", basePrice: 79000, spicyLevel: 2, isFeatured: false, preparationTimeMin: 12,
    },
    {
      slug: "chem-chep-xao",
      name: "Chem chép xào",
      description: "Chem chép xào sả ớt tươi, vị đậm và ăn nhanh.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "chem-chep",
      unit: "phần", basePrice: 69000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 10,
    },
    // ── Ngao 2 còi ───────────────────────────────────────────────
    {
      slug: "ngao-2-coi-hap",
      name: "Ngao 2 còi hấp",
      description: "Ngao 2 còi hấp sả gừng, thịt tươi ngọt nước thanh.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "ngao-2-coi",
      unit: "phần", basePrice: 69000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 10,
    },
    {
      slug: "ngao-2-coi-xao",
      name: "Ngao 2 còi xào",
      description: "Ngao 2 còi xào tỏi ớt, giá bình dân dễ gọi thêm.",
      categorySlug: "so-hao-ngheu", ingredientSlug: "ngao-2-coi",
      unit: "phần", basePrice: 59000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 9,
    },
    // ── Món ăn kèm ────────────────────────────────────────────────
    {
      slug: "xao-mi",
      name: "Xào mì",
      description: "Mì trứng xào với hải sản hoặc rau, ăn kèm các món ốc.",
      categorySlug: "mon-an-kem", ingredientSlug: "mi",
      unit: "dĩa", basePrice: 35000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 7,
    },
    {
      slug: "xao-rau-muong",
      name: "Xào rau muống",
      description: "Rau muống xào tỏi giòn, cân vị bàn nhiều hải sản.",
      categorySlug: "mon-an-kem", ingredientSlug: "rau-muong",
      unit: "dĩa", basePrice: 35000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 6,
    },
    {
      slug: "banh-mi-nuong-muoi-ot",
      name: "Bánh mì nướng muối ớt",
      description: "Bánh mì giòn nướng muối ớt, ăn kèm nước sốt hải sản.",
      categorySlug: "mon-an-kem", ingredientSlug: "banh-mi",
      unit: "phần", basePrice: 25000, spicyLevel: 1, isFeatured: false, preparationTimeMin: 5,
    },
    // ── Nước uống ────────────────────────────────────────────────
    {
      slug: "coca-lon",
      name: "Coca lon",
      description: "Coca-Cola lon lạnh phục vụ tại bàn.",
      categorySlug: "nuoc-uong", ingredientSlug: "coca",
      unit: "lon", basePrice: 18000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 1,
    },
    {
      slug: "pepsi-lon",
      name: "Pepsi lon",
      description: "Pepsi lon lạnh, vị ngọt đặc trưng.",
      categorySlug: "nuoc-uong", ingredientSlug: "pepsi",
      unit: "lon", basePrice: 18000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 1,
    },
    {
      slug: "sting-lon",
      name: "Sting lon",
      description: "Sting lon lạnh, tăng lực đi kèm bữa nhậu.",
      categorySlug: "nuoc-uong", ingredientSlug: "sting",
      unit: "lon", basePrice: 18000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 1,
    },
    {
      slug: "tra-da",
      name: "Trà đá",
      description: "Trà đá mát lạnh miễn phí rót thêm tại quán.",
      categorySlug: "nuoc-uong", ingredientSlug: "tra-da",
      unit: "ly", basePrice: 10000, spicyLevel: 0, isFeatured: false, preparationTimeMin: 1,
    },
  ];

  for (const item of menuItemSeeds) {
    const categoryId   = categoryIds.get(item.categorySlug);
    const ingredientId = ingredientIds.get(item.ingredientSlug);
    if (!categoryId || !ingredientId) continue;

    await prisma.menuItem.create({
      data: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        unit: item.unit,
        spicyLevel: item.spicyLevel,
        basePrice: money(item.basePrice),
        status: MenuItemStatus.ACTIVE,
        isFeatured: item.isFeatured,
        isAvailable: true,
        preparationTimeMin: item.preparationTimeMin,
        categoryId,
        createdById: adminId,
        ingredientPresets: {
          create: [{ ingredientId, consumeQuantity: money(1), sortOrder: 0 }],
        },
      },
    });
  }

  const menuItemsInDb = await prisma.menuItem.findMany();
  for (const item of menuItemsInDb) {
    await prisma.menuItemPrice.create({
      data: {
        menuItemId: item.id,
        price: item.basePrice,
        effectiveFrom: today,
        note: "Giá khởi tạo ban đầu",
      },
    });
  }

  return {
    menuItemsBySlug:   new Map(menuItemsInDb.map((i) => [i.slug, i])),
    ingredientsBySlug: new Map(ingredientsInDb.map((i) => [i.slug, i])),
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

  const dailyMenu = await prisma.dailyMenu.create({
    data: {
      code,
      title: input.title,
      serviceDate: input.day,
      status: input.status,
      note: input.note,
      bannerText: input.bannerText,
      createdById: adminId,
    },
  });

  // Stock pools — mỗi nguyên liệu 1 pool
  const stockPoolTemplates = [
    { stockSlug: "oc-huong-to",   quantity: 12, note: "Pool dùng chung cho các món ốc hương to." },
    { stockSlug: "oc-huong-nho",  quantity: 15, note: "Pool dùng chung cho các món ốc hương nhỏ." },
    { stockSlug: "oc-toi-to",     quantity: 10, note: "Pool ốc tỏi to nướng và xào." },
    { stockSlug: "oc-toi-nho",    quantity: 12, note: "Pool ốc tỏi nhỏ nướng và xào." },
    { stockSlug: "oc-gai",        quantity: 10, note: "Pool ốc gai xào." },
    { stockSlug: "oc-mo",         quantity: 10, note: "Pool ốc mỡ xào." },
    { stockSlug: "oc-gao",        quantity: 15, note: "Pool ốc gạo xào." },
    { stockSlug: "cang-ghe-to",   quantity: 8,  note: "Pool càng ghẹ to xào và nướng." },
    { stockSlug: "cang-ghe-nho",  quantity: 10, note: "Pool càng ghẹ nhỏ xào và nướng." },
    { stockSlug: "so-long",       quantity: 10, note: "Pool sò lông nướng và xào." },
    { stockSlug: "so-huyet",      quantity: 12, note: "Pool sò huyết nướng và cháy tỏi." },
    { stockSlug: "so-lua",        quantity: 10, note: "Pool sò lụa nướng và xào." },
    { stockSlug: "hao",           quantity: 8,  note: "Pool hào nướng phô mai và mỡ hành." },
    { stockSlug: "ngheu",         quantity: 12, note: "Pool nghêu hấp và xào." },
    { stockSlug: "chem-chep",     quantity: 10, note: "Pool chem chép hấp Thái và xào." },
    { stockSlug: "ngao-2-coi",    quantity: 12, note: "Pool ngao 2 còi hấp và xào." },
    { stockSlug: "mi",            quantity: 20, note: "Pool mì xào ăn kèm." },
    { stockSlug: "rau-muong",     quantity: 20, note: "Pool rau muống xào." },
    { stockSlug: "banh-mi",       quantity: 30, note: "Pool bánh mì nướng bán kèm." },
    { stockSlug: "coca",          quantity: 50, note: "Pool Coca lon." },
    { stockSlug: "pepsi",         quantity: 50, note: "Pool Pepsi lon." },
    { stockSlug: "sting",         quantity: 50, note: "Pool Sting lon." },
    { stockSlug: "tra-da",        quantity: 99, note: "Pool trà đá — rót thoải mái." },
  ];

  const poolIdBySlug = new Map<string, number>();
  for (const pool of stockPoolTemplates) {
    const ingredient = ingredientsBySlug.get(pool.stockSlug);
    if (!ingredient) continue;
    const created = await prisma.dailyStockPool.create({
      data: {
        dailyMenuId: dailyMenu.id,
        ingredientId: ingredient.id,
        label: ingredient.name,
        quantity: money(pool.quantity),
        soldQuantity: money(0),
        note: pool.note,
      },
    });
    poolIdBySlug.set(pool.stockSlug, created.id);
  }

  // Offer templates — mỗi món menu item 1 entry
  const offerTemplates = [
    // Ốc hương to
    { menuItemSlug: "oc-huong-to-rang-muoi",      stockSlug: "oc-huong-to",  overridePrice: 149000, highlightLabel: "Bán chạy" },
    { menuItemSlug: "oc-huong-to-xao-bo-toi",     stockSlug: "oc-huong-to",  overridePrice: 159000, highlightLabel: "Bơ tỏi" },
    { menuItemSlug: "oc-huong-to-sot-trung-muoi", stockSlug: "oc-huong-to",  overridePrice: 169000, highlightLabel: "Đặc biệt" },
    // Ốc hương nhỏ
    { menuItemSlug: "oc-huong-nho-rang-muoi",     stockSlug: "oc-huong-nho", overridePrice: 99000,  highlightLabel: "Phổ biến" },
    { menuItemSlug: "oc-huong-nho-xao-bo-toi",    stockSlug: "oc-huong-nho", overridePrice: 109000, highlightLabel: "Thơm bơ" },
    // Ốc tỏi to
    { menuItemSlug: "oc-toi-to-nuong",            stockSlug: "oc-toi-to",    overridePrice: 129000, highlightLabel: "Nướng than" },
    { menuItemSlug: "oc-toi-to-xao",              stockSlug: "oc-toi-to",    overridePrice: 129000, highlightLabel: "Xào sả" },
    // Ốc tỏi nhỏ
    { menuItemSlug: "oc-toi-nho-nuong",           stockSlug: "oc-toi-nho",   overridePrice: 89000,  highlightLabel: null },
    { menuItemSlug: "oc-toi-nho-xao",             stockSlug: "oc-toi-nho",   overridePrice: 89000,  highlightLabel: null },
    // Ốc gai, mỡ, gạo
    { menuItemSlug: "oc-gai-xao",                 stockSlug: "oc-gai",       overridePrice: 69000,  highlightLabel: null },
    { menuItemSlug: "oc-mo-xao",                  stockSlug: "oc-mo",        overridePrice: 59000,  highlightLabel: null },
    { menuItemSlug: "oc-gao-xao",                 stockSlug: "oc-gao",       overridePrice: 49000,  highlightLabel: "Giá tốt" },
    // Ghẹ
    { menuItemSlug: "cang-ghe-to-xao",            stockSlug: "cang-ghe-to",  overridePrice: 169000, highlightLabel: "Xào me" },
    { menuItemSlug: "cang-ghe-to-nuong",          stockSlug: "cang-ghe-to",  overridePrice: 179000, highlightLabel: "Nướng than" },
    { menuItemSlug: "cang-ghe-nho-xao",           stockSlug: "cang-ghe-nho", overridePrice: 119000, highlightLabel: null },
    { menuItemSlug: "cang-ghe-nho-nuong",         stockSlug: "cang-ghe-nho", overridePrice: 119000, highlightLabel: null },
    // Sò lông
    { menuItemSlug: "so-long-nuong-mo-hanh",      stockSlug: "so-long",      overridePrice: 89000,  highlightLabel: "Mỡ hành" },
    { menuItemSlug: "so-long-xao",                stockSlug: "so-long",      overridePrice: 79000,  highlightLabel: null },
    // Sò huyết
    { menuItemSlug: "so-huyet-nuong-moi",         stockSlug: "so-huyet",     overridePrice: 89000,  highlightLabel: null },
    { menuItemSlug: "so-huyet-chay-toi",          stockSlug: "so-huyet",     overridePrice: 99000,  highlightLabel: "Thơm tỏi" },
    // Sò lụa
    { menuItemSlug: "so-lua-nuong",               stockSlug: "so-lua",       overridePrice: 79000,  highlightLabel: null },
    { menuItemSlug: "so-lua-xao",                 stockSlug: "so-lua",       overridePrice: 69000,  highlightLabel: null },
    // Hào
    { menuItemSlug: "hao-nuong-pho-mai",          stockSlug: "hao",          overridePrice: 109000, highlightLabel: "Phô mai" },
    { menuItemSlug: "hao-nuong-mo-hanh",          stockSlug: "hao",          overridePrice: 99000,  highlightLabel: "Mỡ hành" },
    // Nghêu
    { menuItemSlug: "ngheu-hap-sa",               stockSlug: "ngheu",        overridePrice: 79000,  highlightLabel: "Hấp sả" },
    { menuItemSlug: "ngheu-xao",                  stockSlug: "ngheu",        overridePrice: 69000,  highlightLabel: null },
    // Chem chép
    { menuItemSlug: "chem-chep-hap-thai",         stockSlug: "chem-chep",    overridePrice: 79000,  highlightLabel: "Chua cay" },
    { menuItemSlug: "chem-chep-xao",              stockSlug: "chem-chep",    overridePrice: 69000,  highlightLabel: null },
    // Ngao 2 còi
    { menuItemSlug: "ngao-2-coi-hap",             stockSlug: "ngao-2-coi",   overridePrice: 69000,  highlightLabel: null },
    { menuItemSlug: "ngao-2-coi-xao",             stockSlug: "ngao-2-coi",   overridePrice: 59000,  highlightLabel: null },
    // Kèm
    { menuItemSlug: "xao-mi",                     stockSlug: "mi",           overridePrice: 35000,  highlightLabel: "Ăn kèm" },
    { menuItemSlug: "xao-rau-muong",              stockSlug: "rau-muong",    overridePrice: 35000,  highlightLabel: "Ăn kèm" },
    { menuItemSlug: "banh-mi-nuong-muoi-ot",      stockSlug: "banh-mi",      overridePrice: 25000,  highlightLabel: "Gọi thêm" },
    // Nước
    { menuItemSlug: "coca-lon",                   stockSlug: "coca",         overridePrice: 18000,  highlightLabel: null },
    { menuItemSlug: "pepsi-lon",                  stockSlug: "pepsi",        overridePrice: 18000,  highlightLabel: null },
    { menuItemSlug: "sting-lon",                  stockSlug: "sting",        overridePrice: 18000,  highlightLabel: null },
    { menuItemSlug: "tra-da",                     stockSlug: "tra-da",       overridePrice: 10000,  highlightLabel: null },
  ];

  const offerMap = new Map<string, {
    menuItemId: number;
    dailyMenuItemId: number;
    itemNameSnapshot: string;
    unitPrice: number;
    stockSlug: string;
  }>();

  for (const offer of offerTemplates) {
    const menuItem   = menuItemsBySlug.get(offer.menuItemSlug);
    const stockPoolId = poolIdBySlug.get(offer.stockSlug);
    if (!menuItem || !stockPoolId) continue;

    const created = await prisma.dailyMenuItem.create({
      data: {
        dailyMenuId: dailyMenu.id,
        menuItemId: menuItem.id,
        overridePrice: money(offer.overridePrice),
        isAvailable: true,
        highlightLabel: offer.highlightLabel ?? null,
        stockLinks: {
          create: { dailyStockPoolId: stockPoolId, consumeQuantity: money(1) },
        },
      },
    });

    offerMap.set(offer.menuItemSlug, {
      menuItemId: menuItem.id,
      dailyMenuItemId: created.id,
      itemNameSnapshot: menuItem.name,
      unitPrice: offer.overridePrice,
      stockSlug: offer.stockSlug,
    });
  }

  const soldQuantityByStockSlug = new Map<string, number>();

  for (const spec of input.orderSpecs) {
    const customer     = spec.customerKey ? users[spec.customerKey] : null;
    const createdBy    = users[spec.createdByKey];
    const assignedStaff = spec.assignedStaffKey ? users[spec.assignedStaffKey] : null;

    const lines = spec.items
      .map((item) => {
        const offer = offerMap.get(item.menuItemSlug);
        if (!offer) return null;
        const status = item.status ?? getDefaultItemStatus(spec.status);

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
          ...buildSeedStageData(item.quantity, status),
          status,
          lineTotal: money(offer.unitPrice * item.quantity),
          note: item.note,
        };
      })
      .filter(Boolean) as any[];

    const subtotal      = lines.reduce((s: number, i: any) => s + Number(i.lineTotal), 0);
    const serviceFee    = spec.serviceFee    ?? 0;
    const discountAmount = spec.discountAmount ?? 0;
    const totalAmount   = subtotal + serviceFee - discountAmount;

    await prisma.order.create({
      data: {
        orderNumber: `OBT-${dateKey(input.day).replace(/-/g, "")}-${spec.code}`,
        source: spec.source,
        status: spec.status,
        paymentStatus: spec.paymentStatus,
        paymentMethod: spec.paymentMethod,
        tableLabel: spec.tableLabel,
        guestCount: spec.guestCount,
        guestName:  spec.guestName  ?? customer?.fullName ?? null,
        guestPhone: spec.guestPhone ?? customer?.phone    ?? null,
        note: spec.note,
        internalNote: spec.internalNote,
        arrivalAt: spec.arrivalAt,
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
        items: { create: lines },
      },
    });
  }

  for (const [stockSlug, soldQty] of soldQuantityByStockSlug.entries()) {
    const poolId = poolIdBySlug.get(stockSlug);
    if (!poolId) continue;
    await prisma.dailyStockPool.update({
      where: { id: poolId },
      data: { soldQuantity: money(soldQty) },
    });
  }
}

async function seedOrders(
  users: Record<SeedUserKey, Awaited<ReturnType<typeof seedUsers>>[SeedUserKey]>,
  adminId: number,
  menuItemsBySlug: Map<string, any>,
  ingredientsBySlug: Map<string, any>
) {
  const today     = startOfDay();
  const tomorrow  = addDays(today, 1);
  const yesterday = addDays(today, -1);

  // ─── HÔM NAY ──────────────────────────────────────────────────────────────
  await seedServiceDay(
    {
      day: today,
      status: DailyMenuStatus.PUBLISHED,
      title: "Thực đơn hải sản hôm nay",
      note: "Menu ngày — đủ các loại ốc, ghẹ, sò, hào, nghêu và nước uống.",
      bannerText: "Ốc hương to hôm nay dùng chung pool — đặt sớm kẻo hết!",
      orderSpecs: [
        // PENDING — khách app chờ xác nhận
        {
          code: "101",
          createdByKey: "lanAnh",
          customerKey: "lanAnh",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          guestCount: 2,
          tableLabel: "Bàn Hẻm 03",
          note: "Ít cay, giữ nóng giúp bàn.",
          createdAt: atTime(today, 11, 5),
          arrivalAt: atTime(today, 11, 35),
          items: [
            { menuItemSlug: "oc-huong-to-rang-muoi",  quantity: 1 },
            { menuItemSlug: "so-huyet-chay-toi",      quantity: 1 },
            { menuItemSlug: "tra-da",                 quantity: 2 },
          ],
        },
        // PENDING — khách khác chờ xác nhận
        {
          code: "102",
          createdByKey: "quocPhuc",
          customerKey: "quocPhuc",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          guestCount: 4,
          tableLabel: "Phòng VIP",
          note: "Khách VIP, gọi thêm nước khi tới.",
          createdAt: atTime(today, 11, 20),
          arrivalAt: atTime(today, 12, 0),
          items: [
            { menuItemSlug: "cang-ghe-to-nuong",      quantity: 2 },
            { menuItemSlug: "hao-nuong-pho-mai",      quantity: 1 },
            { menuItemSlug: "xao-mi",                 quantity: 1 },
            { menuItemSlug: "coca-lon",               quantity: 2 },
          ],
        },
        // CONFIRMED — staff nhận bàn
        {
          code: "103",
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
          arrivalAt: atTime(today, 11, 50),
          items: [
            { menuItemSlug: "so-long-nuong-mo-hanh",  quantity: 1, status: OrderItemStatus.READY },
            { menuItemSlug: "oc-toi-to-nuong",        quantity: 1, status: OrderItemStatus.COOKING },
            { menuItemSlug: "xao-rau-muong",          quantity: 1, status: OrderItemStatus.WAITING },
            { menuItemSlug: "sting-lon",              quantity: 2, status: OrderItemStatus.WAITING },
          ],
        },
        // CONFIRMED — admin đặt giúp khách văn phòng
        {
          code: "104",
          createdByKey: "admin",
          assignedStaffKey: "staffKhanh",
          customerKey: "minhChau",
          source: OrderSource.ADMIN_POS,
          status: OrderStatus.CONFIRMED,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Mang đi 01",
          guestCount: 2,
          note: "Lấy trước 12h15, ưu tiên ra món sớm.",
          internalNote: "Gói kín để mang đi.",
          createdAt: atTime(today, 12, 0),
          confirmedAt: atTime(today, 12, 3),
          arrivalAt: atTime(today, 12, 15),
          items: [
            { menuItemSlug: "cang-ghe-nho-xao",      quantity: 1, status: OrderItemStatus.COOKING },
            { menuItemSlug: "ngheu-hap-sa",           quantity: 1, status: OrderItemStatus.WAITING },
            { menuItemSlug: "banh-mi-nuong-muoi-ot",  quantity: 2, status: OrderItemStatus.READY },
            { menuItemSlug: "pepsi-lon",              quantity: 2, status: OrderItemStatus.READY },
          ],
        },
        // COMPLETED — đã thanh toán chuyển khoản
        {
          code: "105",
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
          discountAmount: 20000,
          createdAt: atTime(today, 13, 10),
          confirmedAt: atTime(today, 13, 18),
          completedAt: atTime(today, 14, 5),
          arrivalAt: atTime(today, 13, 35),
          items: [
            { menuItemSlug: "oc-huong-to-sot-trung-muoi", quantity: 1 },
            { menuItemSlug: "hao-nuong-pho-mai",           quantity: 1 },
            { menuItemSlug: "xao-mi",                      quantity: 1 },
            { menuItemSlug: "tra-da",                      quantity: 4 },
          ],
        },
        // COMPLETED — tiền mặt bữa tối
        {
          code: "106",
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
          completedAt: atTime(today, 19, 30),
          arrivalAt: atTime(today, 18, 45),
          items: [
            { menuItemSlug: "so-long-xao",            quantity: 1 },
            { menuItemSlug: "chem-chep-hap-thai",     quantity: 1 },
            { menuItemSlug: "sting-lon",              quantity: 2 },
          ],
        },
        // COMPLETED — du lịch
        {
          code: "107",
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
          arrivalAt: atTime(today, 19, 30),
          items: [
            { menuItemSlug: "ngao-2-coi-hap",         quantity: 1 },
            { menuItemSlug: "oc-gai-xao",             quantity: 1 },
            { menuItemSlug: "xao-rau-muong",          quantity: 1 },
            { menuItemSlug: "coca-lon",               quantity: 3 },
          ],
        },
        // CANCELLED — khách đổi lịch
        {
          code: "108",
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
          arrivalAt: atTime(today, 20, 40),
          items: [
            { menuItemSlug: "cang-ghe-to-xao",        quantity: 2 },
            { menuItemSlug: "so-huyet-nuong-moi",      quantity: 2 },
            { menuItemSlug: "tra-da",                  quantity: 6 },
          ],
        },
      ],
    },
    adminId, users, menuItemsBySlug, ingredientsBySlug
  );

  // ─── NGÀY MAI ─────────────────────────────────────────────────────────────
  await seedServiceDay(
    {
      day: tomorrow,
      status: DailyMenuStatus.PUBLISHED,
      title: "Thực đơn hải sản ngày mai",
      note: "Menu ngày mai mở sẵn để admin thêm đơn đặt trước.",
      bannerText: "Ghẹ to ngày mai còn thoáng — đặt trước để giữ phần!",
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
          arrivalAt: atTime(tomorrow, 18, 40),
          items: [
            { menuItemSlug: "oc-huong-nho-rang-muoi", quantity: 1, status: OrderItemStatus.WAITING },
            { menuItemSlug: "so-lua-nuong",            quantity: 1, status: OrderItemStatus.WAITING },
            { menuItemSlug: "tra-da",                  quantity: 2, status: OrderItemStatus.READY },
          ],
        },
        {
          code: "302",
          createdByKey: "lanAnh",
          customerKey: "lanAnh",
          source: OrderSource.CUSTOMER_APP,
          status: OrderStatus.PENDING,
          paymentStatus: PaymentStatus.UNPAID,
          tableLabel: "Sân 03",
          guestCount: 3,
          note: "Có thể gọi thêm ghẹ khi tới quán.",
          createdAt: atTime(tomorrow, 19, 0),
          arrivalAt: atTime(tomorrow, 19, 25),
          items: [
            { menuItemSlug: "cang-ghe-nho-nuong",     quantity: 1 },
            { menuItemSlug: "hao-nuong-mo-hanh",      quantity: 1 },
            { menuItemSlug: "pepsi-lon",              quantity: 3 },
          ],
        },
      ],
    },
    adminId, users, menuItemsBySlug, ingredientsBySlug
  );

  // ─── HÔM QUA ──────────────────────────────────────────────────────────────
  await seedServiceDay(
    {
      day: yesterday,
      status: DailyMenuStatus.ARCHIVED,
      title: "Thực đơn hải sản hôm qua",
      note: "Menu lưu lại để kiểm tra lịch sử đơn hàng sau khi chốt ca.",
      bannerText: "Menu đã kết thúc.",
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
          arrivalAt: atTime(yesterday, 18, 40),
          items: [
            { menuItemSlug: "so-huyet-chay-toi",      quantity: 1 },
            { menuItemSlug: "oc-mo-xao",              quantity: 1 },
            { menuItemSlug: "tra-da",                 quantity: 2 },
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
          arrivalAt: atTime(yesterday, 19, 45),
          items: [
            { menuItemSlug: "cang-ghe-to-xao",        quantity: 1 },
            { menuItemSlug: "xao-rau-muong",          quantity: 1 },
            { menuItemSlug: "banh-mi-nuong-muoi-ot",  quantity: 2 },
            { menuItemSlug: "sting-lon",              quantity: 2 },
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
          arrivalAt: atTime(yesterday, 21, 20),
          items: [
            { menuItemSlug: "ngheu-xao",              quantity: 1 },
            { menuItemSlug: "coca-lon",               quantity: 1 },
          ],
        },
      ],
    },
    adminId, users, menuItemsBySlug, ingredientsBySlug
  );
}

async function main() {
  console.log("Đang xóa dữ liệu cũ...");
  await cleanDatabase();

  console.log("Đang tạo users...");
  const users = await seedUsers();

  console.log("Đang tạo danh mục & thực đơn...");
  const admin = users.admin;
  const { menuItemsBySlug, ingredientsBySlug } = await seedCatalog(admin.id);

  console.log("Đang tạo đơn hàng mẫu...");
  await seedOrders(users, admin.id, menuItemsBySlug, ingredientsBySlug);

  console.log("✓ Seed hoàn tất!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
