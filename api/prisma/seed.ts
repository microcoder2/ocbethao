import bcrypt from "bcryptjs";
import { MenuItemStatus, Prisma } from "@prisma/client";
import { prisma } from "../src/utils/prisma";
import {
  deleteAllLocalAuthIdentities,
  upsertAuthIdentityForUser,
} from "../src/services/accountIdentityService";
import { demoTodayMenu, seedCategories, seedIngredients } from "./seed-data/catalog";
import rawSeedMenuItems from "./seed-data/menu-items.json";
import {
  type SeedUserKey,
  type SeedUserProfile,
  seedUserProfiles,
} from "./seed-data/users";

function startOfDay(base = new Date()): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate());
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

type SeedIngredientRecord = {
  id: number;
  slug: string;
  name: string;
};

type SeedCategoryRecord = {
  id: number;
  slug: string;
};

type SeedMenuItem = {
  slug: string;
  name: string;
  description?: string;
  categorySlug: string;
  ingredientSlug: string;
  unit: string;
  currentPrice: number;
  spicyLevel?: number;
  isFeatured?: boolean;
  preparationTimeMin?: number;
  consumeQuantity?: number;
};

const seedMenuItems = rawSeedMenuItems as SeedMenuItem[];

function resolveSeedCategorySlug(slug: string): string {
  if (slug === "so" || slug === "ngao-ngheu" || slug === "hau" || slug === "ghe") {
    return "hai-manh";
  }
  if (slug === "mon-phu") {
    return "khac";
  }
  return slug;
}

async function cleanDatabase() {
  await prisma.orderItemConsumption.deleteMany({});
  await prisma.inventoryMovement.deleteMany({});
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

  for (const profile of Object.values(seedUserProfiles)) {
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
      OR: Object.values(seedUserProfiles).map((profile) =>
        profile.email ? { email: profile.email } : { phone: profile.phone as string }
      ),
    },
  });

  const byKey = new Map<SeedUserKey, (typeof users)[number]>();
  for (const [key, profile] of Object.entries(seedUserProfiles) as Array<
    [SeedUserKey, SeedUserProfile]
  >) {
    const user = users.find((entry) =>
      profile.email ? entry.email === profile.email : entry.phone === profile.phone
    );
    if (user) byKey.set(key, user);
  }

  const authSeeds = [
    {
      key: "lanAnh" as const,
      payload: {
        provider: "zalo",
        providerUserId: "zalo-lan-anh-0909000003",
        providerPhone: seedUserProfiles.lanAnh.phone,
        displayName: seedUserProfiles.lanAnh.fullName,
        phoneVerified: true,
      },
    },
    {
      key: "quocPhuc" as const,
      payload: {
        provider: "facebook",
        providerUserId: "facebook-quoc-phuc-001",
        providerPhone: seedUserProfiles.quocPhuc.phone,
        displayName: seedUserProfiles.quocPhuc.fullName,
        phoneVerified: true,
      },
    },
    {
      key: "minhChau" as const,
      payload: {
        provider: "google",
        providerUserId: "google-minh-chau-001",
        providerEmail: seedUserProfiles.minhChau.email,
        displayName: seedUserProfiles.minhChau.fullName,
        emailVerified: true,
      },
    },
    {
      key: "anNhi" as const,
      payload: {
        provider: "google",
        providerUserId: "google-an-nhi-001",
        providerEmail: seedUserProfiles.anNhi.email,
        displayName: seedUserProfiles.anNhi.fullName,
        emailVerified: true,
      },
    },
  ];

  for (const authSeed of authSeeds) {
    const user = byKey.get(authSeed.key);
    if (!user) continue;
    await upsertAuthIdentityForUser(user.id, authSeed.payload);
  }

  return Object.fromEntries(
    Array.from(byKey.entries()).map(([key, user]) => [key, user])
  ) as Record<SeedUserKey, (typeof users)[number]>;
}

async function seedCatalog() {
  for (const category of seedCategories) {
    await prisma.category.create({ data: category });
  }

  for (const ingredient of seedIngredients) {
    await prisma.ingredient.create({
      data: {
        name: ingredient.name,
        slug: ingredient.slug,
        description: ingredient.description,
        unit: ingredient.unit,
        isActive: true,
      },
    });
  }

  const categories = await prisma.category.findMany({
    select: { id: true, slug: true },
  });

  const ingredients = await prisma.ingredient.findMany({
    select: { id: true, slug: true, name: true },
  });

  return {
    categoriesBySlug: new Map(categories.map((category) => [category.slug, category])),
    ingredientsBySlug: new Map(ingredients.map((ingredient) => [ingredient.slug, ingredient])),
  };
}

async function seedMenuBank(
  adminId: number,
  categoriesBySlug: Map<string, SeedCategoryRecord>,
  ingredientsBySlug: Map<string, SeedIngredientRecord>
) {
  if (!seedMenuItems.length) return;

  const today = startOfDay();

  for (const item of seedMenuItems) {
    const resolvedCategorySlug = resolveSeedCategorySlug(item.categorySlug);
    const category = categoriesBySlug.get(resolvedCategorySlug);
    const ingredient = ingredientsBySlug.get(item.ingredientSlug);

    if (!category || !ingredient) continue;

    await prisma.menuItem.create({
      data: {
        name: item.name,
        slug: item.slug,
        description: item.description,
        unit: item.unit,
        currentPrice: money(item.currentPrice),
        spicyLevel: item.spicyLevel ?? 0,
        status: MenuItemStatus.ACTIVE,
        isFeatured: Boolean(item.isFeatured),
        isAvailable: true,
        preparationTimeMin: item.preparationTimeMin ?? 10,
        categoryId: category.id,
        createdById: adminId,
        ingredientPresets: {
          create: [
            {
              ingredientId: ingredient.id,
              consumeQuantity: money(item.consumeQuantity ?? 1),
              sortOrder: 0,
            },
          ],
        },
        priceHistories: {
          create: [
            {
              price: money(item.currentPrice),
              effectiveFrom: today,
              note: "Giá khởi tạo từ seed ngân hàng món",
            },
          ],
        },
      },
    });
  }
}

async function seedTodayMenu(
  adminId: number,
  ingredientsBySlug: Map<string, SeedIngredientRecord>
) {
  const today = startOfDay();

  const dailyMenu = await prisma.dailyMenu.create({
    data: {
      code: `MENU-${dateKey(today)}`,
      title: demoTodayMenu.title,
      serviceDate: today,
      status: demoTodayMenu.status,
      note: demoTodayMenu.note,
      bannerText: demoTodayMenu.bannerText,
      createdById: adminId,
    },
  });

  for (const ingredientSeed of seedIngredients) {
    const ingredient = ingredientsBySlug.get(ingredientSeed.slug);
    if (!ingredient || ingredientSeed.demoStockQuantity <= 0) continue;

    await prisma.dailyStockPool.create({
      data: {
        dailyMenuId: dailyMenu.id,
        ingredientId: ingredient.id,
        label: ingredient.name,
        quantity: money(ingredientSeed.demoStockQuantity),
        soldQuantity: money(0),
        note: `Pool seed cho ${ingredient.name}`,
      },
    });
  }
}

async function main() {
  console.log("Đang xóa dữ liệu cũ...");
  await cleanDatabase();

  console.log("Đang tạo users...");
  const users = await seedUsers();

  console.log("Đang tạo danh mục và nguyên liệu...");
  const { categoriesBySlug, ingredientsBySlug } = await seedCatalog();

  console.log("Đang tạo ngân hàng món...");
  await seedMenuBank(users.admin.id, categoriesBySlug, ingredientsBySlug);

  console.log("Đang tạo menu ngày mẫu...");
  await seedTodayMenu(users.admin.id, ingredientsBySlug);

  console.log("Seed hoàn tất.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
