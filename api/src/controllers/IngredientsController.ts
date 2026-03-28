import {
  Body,
  Controller,
  Delete,
  Get,
  Path,
  Post,
  Put,
  Query,
  Route,
  Security,
  Tags,
} from "tsoa";
import { prisma } from "../utils/prisma";
import { serializeIngredient } from "../utils/mappers";
import { deletePublicImage } from "../utils/uploads";

class IngredientBody {
  name!: string;
  slug!: string;
  description?: string;
  unit?: string;
  imageUrl?: string;
  isActive?: boolean;
}

@Route("ingredients")
@Tags("Ingredients")
export class IngredientsController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getIngredients(
    @Query() search?: string,
    @Query() activeOnly?: boolean
  ) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }
    if (search?.trim()) {
      where.OR = [
        { name: { contains: search.trim() } },
        { slug: { contains: search.trim() } },
      ];
    }

    const ingredients = await prisma.ingredient.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
    });
    return ingredients.map(serializeIngredient);
  }

  @Get("{id}")
  @Security("bearerAuth", ["ADMIN", "STAFF"])
  public async getIngredientById(@Path() id: number) {
    const ingredient = await prisma.ingredient.findUniqueOrThrow({
      where: { id },
    });
    return serializeIngredient(ingredient);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createIngredient(@Body() body: IngredientBody) {
    const created = await prisma.ingredient.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        unit: body.unit || "phan",
        imageUrl: body.imageUrl,
        isActive: body.isActive ?? true,
      },
    });
    this.setStatus(201);
    return serializeIngredient(created);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateIngredient(@Path() id: number, @Body() body: IngredientBody) {
    const current = await prisma.ingredient.findUniqueOrThrow({ where: { id } });

    if (body.imageUrl !== current.imageUrl && current.imageUrl) {
      deletePublicImage(current.imageUrl);
    }

    const updated = await prisma.ingredient.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        unit: body.unit || "phan",
        imageUrl: body.imageUrl,
        isActive: body.isActive ?? true,
      },
    });
    return serializeIngredient(updated);
  }

  @Delete("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async deleteIngredient(@Path() id: number) {
    await prisma.ingredient.update({
      where: { id },
      data: { isActive: false },
    });
    this.setStatus(204);
  }
}
