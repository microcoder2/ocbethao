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
}

class PriceHistoryBody {
  price!: number;
  effectiveFrom!: string;
  effectiveTo?: string;
  note?: string;
}

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
    const where: any = {};
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
      include: {
        category: true,
        priceHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 5,
        },
      },
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
        category: true,
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
    const item = await prisma.menuItem.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        unit: body.unit || "phan",
        spicyLevel: body.spicyLevel,
        imageUrl: body.imageUrl,
        basePrice: new Prisma.Decimal(body.basePrice.toFixed(2)),
        categoryId: body.categoryId,
        status: body.status ?? MenuItemStatus.ACTIVE,
        isFeatured: body.isFeatured ?? false,
        isAvailable: body.isAvailable ?? true,
        preparationTimeMin: body.preparationTimeMin,
        createdById: authUser.id,
        priceHistories: {
          create: {
            price: new Prisma.Decimal(body.basePrice.toFixed(2)),
            effectiveFrom: new Date(),
            note: "Gia khoi tao",
          },
        },
      },
      include: {
        category: true,
        priceHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 5,
        },
      },
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
    };

    const newBasePrice = new Prisma.Decimal(body.basePrice.toFixed(2));
    if (Number(current.basePrice) !== body.basePrice) {
      data.basePrice = newBasePrice;
      data.priceHistories = {
        create: {
          price: newBasePrice,
          effectiveFrom: new Date(),
          note: "Cap nhat gia tu trang quan ly mon",
        },
      };
    }

    const updated = await prisma.menuItem.update({
      where: { id },
      data,
      include: {
        category: true,
        priceHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 5,
        },
      },
    });
    return serializeMenuItem(updated);
  }

  @Post("{id}/price")
  @Security("bearerAuth", ["ADMIN"])
  public async addPriceHistory(@Path() id: number, @Body() body: PriceHistoryBody) {
    const price = new Prisma.Decimal(body.price.toFixed(2));
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
        category: true,
        priceHistories: {
          orderBy: { effectiveFrom: "desc" },
          take: 20,
        },
      },
    });
    return serializeMenuItem(item);
  }
}
