import {
  Body,
  Controller,
  Get,
  Request,
  Put,
  Route,
  Security,
  Tags,
} from "tsoa";
import { Prisma } from "@prisma/client";
import type { Request as ExRequest } from "express";
import { prisma } from "../utils/prisma";
import { serializeIngredientStock } from "../utils/mappers";

class IngredientStockInput {
  ingredientId!: number;
  label?: string;
  quantity!: number;
  isAvailable?: boolean;
  note?: string;
}

function toMoney(value: number) {
  return new Prisma.Decimal(Number(value || 0).toFixed(2));
}

@Route("ingredient-stocks")
@Tags("Ingredient Stocks")
export class IngredientStocksController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getIngredientStocks() {
    const stocks = await prisma.ingredientStock.findMany({
      include: { ingredient: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    return stocks.map(serializeIngredientStock);
  }

  @Put("/")
  @Security("bearerAuth", ["ADMIN"])
  public async saveIngredientStocks(
    @Body() body: IngredientStockInput[],
    @Request() req: ExRequest
  ) {
    const authUser = (req as any).user;
    const normalized = (Array.isArray(body) ? body : [])
      .filter(
        (item) =>
          item &&
          typeof item.ingredientId === "number" &&
          typeof item.quantity === "number" &&
          item.quantity >= 0
      )
      .map((item) => ({
        ingredientId: item.ingredientId,
        label: item.label?.trim() || undefined,
        quantity: item.quantity,
        isAvailable: item.isAvailable ?? true,
        note: item.note?.trim() || undefined,
      }));

    await prisma.$transaction(async (tx) => {
      for (const item of normalized) {
        const existing = await tx.ingredientStock.findUnique({
          where: { ingredientId: item.ingredientId },
          select: { id: true, quantity: true, soldQuantity: true },
        });
        const nextQuantity = Math.max(item.quantity, Number(existing?.soldQuantity || 0));
        const previousQuantity = Number(existing?.quantity || 0);

        await tx.ingredientStock.upsert({
          where: { ingredientId: item.ingredientId },
          create: {
            ingredientId: item.ingredientId,
            label: item.label,
            quantity: toMoney(nextQuantity),
            soldQuantity: new Prisma.Decimal(0),
            isAvailable: item.isAvailable,
            note: item.note,
          },
          update: {
            label: item.label,
            quantity: toMoney(nextQuantity),
            isAvailable: item.isAvailable,
            note: item.note,
          },
        });

        const quantityDelta = Number((nextQuantity - previousQuantity).toFixed(2));
        if (quantityDelta !== 0) {
          await tx.inventoryMovement.create({
            data: {
              ingredientId: item.ingredientId,
              movementType: "MANUAL_ADJUST",
              quantityDelta: toMoney(quantityDelta),
              note: item.note?.trim()
                ? `Cap nhat ton kho thu cong. ${item.note.trim()}`
                : "Cap nhat ton kho thu cong.",
              createdById: authUser?.id ?? null,
            },
          });
        }
      }
    });

    const stocks = await prisma.ingredientStock.findMany({
      include: { ingredient: true },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    });
    return stocks.map(serializeIngredientStock);
  }
}
