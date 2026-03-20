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
import { DailyMenuStatus, Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeDailyMenu } from "../utils/mappers";

class DailyMenuItemInput {
  menuItemId!: number;
  quantity?: number;
  overridePrice?: number;
  isAvailable?: boolean;
  highlightLabel?: string;
}

class DailyMenuBody {
  code?: string;
  title!: string;
  serviceDate!: string;
  status?: DailyMenuStatus;
  note?: string;
  bannerText?: string;
  items!: DailyMenuItemInput[];
}

async function syncDailyMenuItems(
  tx: Prisma.TransactionClient,
  dailyMenuId: number,
  items: DailyMenuItemInput[]
): Promise<void> {
  const menuItemIds = items.map((item) => item.menuItemId);
  if (menuItemIds.length === 0) {
    await tx.dailyMenuItem.deleteMany({ where: { dailyMenuId } });
    return;
  }

  await tx.dailyMenuItem.deleteMany({
    where: {
      dailyMenuId,
      menuItemId: { notIn: menuItemIds },
    },
  });

  for (const item of items) {
    await tx.dailyMenuItem.upsert({
      where: {
        dailyMenuId_menuItemId: {
          dailyMenuId,
          menuItemId: item.menuItemId,
        },
      },
      update: {
        quantity: item.quantity,
        overridePrice:
          typeof item.overridePrice === "number"
            ? new Prisma.Decimal(item.overridePrice.toFixed(2))
            : null,
        isAvailable: item.isAvailable ?? true,
        highlightLabel: item.highlightLabel,
      },
      create: {
        dailyMenuId,
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        overridePrice:
          typeof item.overridePrice === "number"
            ? new Prisma.Decimal(item.overridePrice.toFixed(2))
            : undefined,
        isAvailable: item.isAvailable ?? true,
        highlightLabel: item.highlightLabel,
      },
    });
  }
}

async function getDailyMenuDetail(id: number) {
  return prisma.dailyMenu.findUniqueOrThrow({
    where: { id },
    include: {
      items: {
        include: {
          menuItem: {
            include: {
              category: true,
              priceHistories: {
                orderBy: { effectiveFrom: "desc" },
                take: 1,
              },
            },
          },
        },
        orderBy: { id: "asc" },
      },
    },
  });
}

function buildMenuCode(serviceDate: string): string {
  return `MENU-${serviceDate}`;
}

@Route("daily-menus")
@Tags("Daily Menus")
export class DailyMenusController extends Controller {
  @Get("public/today")
  public async getPublicToday(@Query() date?: string) {
    const targetDate = date || new Date().toISOString().slice(0, 10);
    const menu = await prisma.dailyMenu.findFirst({
      where: {
        serviceDate: new Date(targetDate),
        status: DailyMenuStatus.PUBLISHED,
      },
      include: {
        items: {
          where: { isAvailable: true },
          include: {
            menuItem: {
              include: {
                category: true,
                priceHistories: {
                  orderBy: { effectiveFrom: "desc" },
                  take: 1,
                },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });
    if (!menu) {
      return null;
    }
    return serializeDailyMenu(menu);
  }

  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getDailyMenus(
    @Query() status?: DailyMenuStatus,
    @Query() date?: string
  ) {
    const where: any = {};
    if (status) {
      where.status = status;
    }
    if (date) {
      where.serviceDate = new Date(date);
    }

    const menus = await prisma.dailyMenu.findMany({
      where,
      include: {
        items: {
          include: {
            menuItem: {
              include: {
                category: true,
                priceHistories: {
                  orderBy: { effectiveFrom: "desc" },
                  take: 1,
                },
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: [{ serviceDate: "desc" }, { createdAt: "desc" }],
    });
    return menus.map(serializeDailyMenu);
  }

  @Get("{id}")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getDailyMenuById(@Path() id: number) {
    const menu = await getDailyMenuDetail(id);
    return serializeDailyMenu(menu);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createDailyMenu(
    @Request() req: ExRequest,
    @Body() body: DailyMenuBody
  ) {
    const authUser = (req as any).user;
    const code = body.code || buildMenuCode(body.serviceDate);

    const created = await prisma.$transaction(async (tx) => {
      const menu = await tx.dailyMenu.create({
        data: {
          code,
          title: body.title,
          serviceDate: new Date(body.serviceDate),
          status: body.status ?? DailyMenuStatus.DRAFT,
          note: body.note,
          bannerText: body.bannerText,
          createdById: authUser.id,
        },
      });

      await syncDailyMenuItems(tx, menu.id, body.items || []);
      return menu.id;
    });

    const menu = await getDailyMenuDetail(created);
    this.setStatus(201);
    return serializeDailyMenu(menu);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateDailyMenu(@Path() id: number, @Body() body: DailyMenuBody) {
    await prisma.$transaction(async (tx) => {
      await tx.dailyMenu.update({
        where: { id },
        data: {
          code: body.code || buildMenuCode(body.serviceDate),
          title: body.title,
          serviceDate: new Date(body.serviceDate),
          status: body.status ?? DailyMenuStatus.DRAFT,
          note: body.note,
          bannerText: body.bannerText,
        },
      });

      await syncDailyMenuItems(tx, id, body.items || []);
    });

    const menu = await getDailyMenuDetail(id);
    return serializeDailyMenu(menu);
  }

  @Post("{id}/publish")
  @Security("bearerAuth", ["ADMIN"])
  public async publishDailyMenu(@Path() id: number) {
    const menu = await prisma.dailyMenu.update({
      where: { id },
      data: { status: DailyMenuStatus.PUBLISHED },
    });
    return {
      id: menu.id,
      status: menu.status,
      message: "Daily menu published",
    };
  }
}
