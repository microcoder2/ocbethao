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
import bcrypt from "bcryptjs";
import { AuthProvider, CustomerType, Prisma, Role } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeUser } from "../utils/mappers";

class UserBody {
  fullName!: string;
  password?: string;
  role!: Role;
  username?: string;
  phone?: string;
  email?: string;
  zaloId?: string;
  appleId?: string;
  preferredAuthProvider?: AuthProvider;
  customerType?: CustomerType;
  avatarUrl?: string;
  notes?: string;
  isActive?: boolean;
}

@Route("users")
@Tags("Users")
export class UsersController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN"])
  public async getUsers(@Query() role?: Role, @Query() search?: string) {
    const where: any = {};
    if (role) {
      where.role = role;
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
    return users.map(serializeUser);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createUser(@Body() body: UserBody) {
    if (!body.password) {
      this.setStatus(400);
      return { message: "password is required" };
    }

    const password = await bcrypt.hash(body.password, 10);
    const data: Prisma.UserCreateInput = {
      fullName: body.fullName,
      password,
      role: body.role,
      username: body.username,
      phone: body.phone,
      email: body.email,
      zaloId: body.zaloId,
      appleId: body.appleId,
      preferredAuthProvider: body.preferredAuthProvider,
      customerType: body.customerType,
      avatarUrl: body.avatarUrl,
      notes: body.notes,
      isActive: body.isActive ?? true,
    };

    const user = await prisma.user.create({ data });
    this.setStatus(201);
    return serializeUser(user);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateUser(@Path() id: number, @Body() body: UserBody) {
    const data: Prisma.UserUpdateInput = {
      fullName: body.fullName,
      role: body.role,
      username: body.username,
      phone: body.phone,
      email: body.email,
      zaloId: body.zaloId,
      appleId: body.appleId,
      preferredAuthProvider: body.preferredAuthProvider,
      customerType: body.customerType,
      avatarUrl: body.avatarUrl,
      notes: body.notes,
      isActive: body.isActive ?? true,
    };

    if (body.password) {
      data.password = await bcrypt.hash(body.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
    });
    return serializeUser(user);
  }
}
