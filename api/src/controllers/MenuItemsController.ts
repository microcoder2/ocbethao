import {
  Body,
  Controller,
  Get,
  Path,
  Post,
  Put,
  Query,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";
import { MenuItemStatus, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeMenuItem } from "../utils/mappers";

class MenuItemIngredientPresetBody {
  ingredientId!: number;
  consumeQuantity?: number;
  sortOrder?: number;
  note?: string;
}

class MenuItemBody {
  name!: string;
  slug!: string;
  description?: string;
  unit?: string;
  spicyLevel?: number;
  imageUrl?: string;
  basePrice!: number;
  categoryId!: number;
  status?: MenuItemStatus;
  isFeatured?: boolean;
  isAvailable?: boolean;
  preparationTimeMin?: number;
  ingredientPresets?: MenuItemIngredientPresetBody[];
}

class PriceHistoryBody {
  price!: number;
  effectiveFrom!: string;
  effectiveTo?: string;
  note?: string;
}

function toMoney(value: number): Prisma.Decimal {
  return new Prisma.Decimal(value.toFixed(2));
}

function normalizeIngredientPresets(presets?: MenuItemIngredientPresetBody[]) {
  const dedup = new Map<number, MenuItemIngredientPresetBody>();
  for (const preset of presets || []) {
    if (!preset || typeof preset.ingredientId !== "number") continue;
    dedup.set(preset.ingredientId, {
      ingredientId: preset.ingredientId,
      consumeQuantity: typeof preset.consumeQuantity === "number" ? preset.consumeQuantity : 1,
      sortOrder: typeof preset.sortOrder === "number" ? preset.sortOrder : 0,
      note: preset.note,
    });
  }

  return Array.from(dedup.values()).sort(
    (left, right) => (left.sortOrder || 0) - (right.sortOrder || 0)
  );
}

const menuItemInclude = {
  category: true,
  ingredientPresets: {
    include: { ingredient: true },
    orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
  },
  priceHistories: {
    orderBy: { effectiveFrom: "desc" as const },
    take: 5,
  },
};

@Route("menu-items")
@Tags("Menu Items")
export class MenuItemsController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getMenuItems(
    @Query() search?: string,
    @Query() categoryId?: number,
    @Query() status?: MenuItemStatus
  ) {
    const where: Prisma.MenuItemWhereInput = {};
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { slug: { contains: search.trim() } },
      ];
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (status) {
      where.status = status;
    }

    const items = await prisma.menuItem.findMany({
      where,
      include: menuItemInclude,
      orderBy: [{ isFeatured: "desc" }, { updatedAt: "desc" }],
    });
    return items.map(serializeMenuItem);
  }

  @Get("{id}")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getMenuItemById(@Path() id: number) {
    const item = await prisma.menuItem.findUniqueOrThrow({
      where: { id },
      include: {
        ...menuItemInclude,
        priceHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 20,
        },
      },
    });
    return serializeMenuItem(item);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createMenuItem(
    @Request() req: ExRequest,
    @Body() body: MenuItemBody
  ) {
    const authUser = (req as any).user;
    const ingredientPresets = normalizeIngredientPresets(body.ingredientPresets);
    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        unit: body.unit || "phan",
        spicyLevel: body.spicyLevel,
        imageUrl: body.imageUrl,
        basePrice: toMoney(body.basePrice),
        categoryId: body.categoryId,
        status: body.status ?? MenuItemStatus.ACTIVE,
        isFeatured: body.isFeatured ?? false,
        isAvailable: body.isAvailable ?? true,
        preparationTimeMin: body.preparationTimeMin,
        createdById: authUser.id,
        priceHistories: {
          create: {
            price: toMoney(body.basePrice),
            effectiveFrom: new Date(),
            note: "Giá mẫu khởi tạo",
          },
        },
        ingredientPresets: {
          create: ingredientPresets.map((preset) => ({
            ingredientId: preset.ingredientId,
            consumeQuantity: toMoney(preset.consumeQuantity || 1),
            sortOrder: preset.sortOrder ?? 0,
            note: preset.note,
          })),
        },
      },
      include: menuItemInclude,
    });
    this.setStatus(201);
    return serializeMenuItem(item);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateMenuItem(@Path() id: number, @Body() body: MenuItemBody) {
    const current = await prisma.menuItem.findUniqueOrThrow({
      where: { id },
    });

    const ingredientPresets = normalizeIngredientPresets(body.ingredientPresets);
    const data: Prisma.MenuItemUpdateInput = {
      name: body.name,
      slug: body.slug,
      description: body.description,
      unit: body.unit || current.unit,
      spicyLevel: body.spicyLevel,
      imageUrl: body.imageUrl,
      category: { connect: { id: body.categoryId } },
      status: body.status ?? current.status,
      isFeatured: body.isFeatured ?? current.isFeatured,
      isAvailable: body.isAvailable ?? current.isAvailable,
      preparationTimeMin: body.preparationTimeMin,
      ingredientPresets: {
        deleteMany: {},
        create: ingredientPresets.map((preset) => ({
          ingredientId: preset.ingredientId,
          consumeQuantity: toMoney(preset.consumeQuantity || 1),
          sortOrder: preset.sortOrder ?? 0,
          note: preset.note,
        })),
      },
    };

    const newBasePrice = toMoney(body.basePrice);
    if (Number(current.basePrice) !== body.basePrice) {
      data.basePrice = newBasePrice;
      data.priceHistories = {
        create: {
          price: newBasePrice,
          effectiveFrom: new Date(),
          note: "Cập nhật giá mẫu từ trang quản lý món",
        },
      };
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
      include: menuItemInclude,
    });
    return serializeMenuItem(updated);
  }

  @Post("{id}/price")
  @Security("bearerAuth", ["ADMIN"])
  public async addPriceHistory(@Path() id: number, @Body() body: PriceHistoryBody) {
    const price = toMoney(body.price);
    await prisma.menuItemPrice.create({
      data: {
        menuItemId: id,
        price,
        effectiveFrom: new Date(body.effectiveFrom),
        effectiveTo: body.effectiveTo ? new Date(body.effectiveTo) : undefined,
        note: body.note,
      },
    });

    await prisma.menuItem.update({
      where: { id },
      data: {
        basePrice: price,
      },
    });

    const item = await prisma.menuItem.findUniqueOrThrow({
      where: { id },
      include: {
        ...menuItemInclude,
        priceHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 20,
        },
      },
    });
    return serializeMenuItem(item);
  }
}
