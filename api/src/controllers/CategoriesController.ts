import {
  Body,
  Controller,
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
import { serializeCategory } from "../utils/mappers";

class CategoryBody {
  name!: string;
  slug!: string;
  description?: string;
  sortOrder?: number;
  isActive?: boolean;
}

@Route("categories")
@Tags("Categories")
export class CategoriesController extends Controller {
  @Get("/")
  public async getCategories(@Query() activeOnly?: boolean) {
    const where: any = {};
    if (activeOnly) {
      where.isActive = true;
    }

    const categories = await prisma.category.findMany({
      where,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
    return categories.map(serializeCategory);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createCategory(@Body() body: CategoryBody) {
    const created = await prisma.category.create({
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });
    this.setStatus(201);
    return serializeCategory(created);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateCategory(@Path() id: number, @Body() body: CategoryBody) {
    const updated = await prisma.category.update({
      where: { id },
      data: {
        name: body.name,
        slug: body.slug,
        description: body.description,
        sortOrder: body.sortOrder ?? 0,
        isActive: body.isActive ?? true,
      },
    });
    return serializeCategory(updated);
  }
}
