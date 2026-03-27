import {
  Body,
  Controller,
  Delete,
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
import bcrypt from "bcryptjs";
import { CustomerType, Prisma, Role } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeUser } from "../utils/mappers";
import { syncUserAuthSetup } from "../services/authService";

class AuthIdentityBody {
  provider!: string;
  providerUserId!: string;
  providerEmail?: string;
  providerPhone?: string;
  providerUsername?: string;
  displayName?: string;
  avatarUrl?: string;
  emailVerified?: boolean;
  phoneVerified?: boolean;
}

class UserBody {
  fullName!: string;
  password?: string;
  role!: Role;
  username?: string;
  phone?: string;
  email?: string;
  preferredAuthProvider?: string;
  customerType?: CustomerType;
  avatarUrl?: string;
  notes?: string;
  isActive?: boolean;
  authIdentities?: AuthIdentityBody[];
}

@Route("users")
@Tags("Users")
export class UsersController extends Controller {
  @Get("/")
  @Security("bearerAuth", ["ADMIN"])
  public async getUsers(@Query() role?: Role, @Query() search?: string) {
    const where: Prisma.UserWhereInput = {};
    if (role) {
      where.role = role;
    }
    if (search?.trim()) {
      const q = search.trim();
      where.OR = [
        { fullName: { contains: q } },
        { username: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        {
          authIdentities: {
            some: {
              providerUserId: { contains: q },
            },
          },
        },
      ];
    }

    const users = await prisma.user.findMany({
      where,
      include: {
        authIdentities: true,
      },
      orderBy: { createdAt: "desc" },
    });
    return users.map(serializeUser);
  }

  @Post("/")
  @Security("bearerAuth", ["ADMIN"])
  public async createUser(@Body() body: UserBody) {
    if (!body.password && (!Array.isArray(body.authIdentities) || body.authIdentities.length === 0)) {
      this.setStatus(400);
      return { message: "password or authIdentities is required" };
    }

    const password = body.password ? await bcrypt.hash(body.password, 10) : undefined;
    const data: Prisma.UserCreateInput = {
      fullName: body.fullName,
      password,
      role: body.role,
      username: body.username,
      phone: body.phone,
      email: body.email?.toLowerCase(),
      preferredAuthProvider: body.preferredAuthProvider,
      customerType: body.customerType,
      avatarUrl: body.avatarUrl,
      notes: body.notes,
      isActive: body.isActive ?? true,
    };

    const user = await prisma.user.create({
      data,
      include: {
        authIdentities: true,
      },
    });

    const updated = await syncUserAuthSetup(user.id, {
      preferredAuthProvider: body.preferredAuthProvider,
      authIdentities: body.authIdentities,
    });

    this.setStatus(201);
    return serializeUser(updated);
  }

  @Put("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async updateUser(@Path() id: number, @Body() body: UserBody) {
    const data: Prisma.UserUpdateInput = {
      fullName: body.fullName,
      role: body.role,
      username: body.username,
      phone: body.phone,
      email: body.email?.toLowerCase(),
      preferredAuthProvider: body.preferredAuthProvider,
      customerType: body.customerType,
      avatarUrl: body.avatarUrl,
      notes: body.notes,
      isActive: body.isActive ?? true,
    };

    if (body.password) {
      data.password = await bcrypt.hash(body.password, 10);
    }

    await prisma.user.update({
      where: { id },
      data,
    });

    const updated = await syncUserAuthSetup(id, {
      preferredAuthProvider: body.preferredAuthProvider,
      authIdentities: body.authIdentities,
    });

    return serializeUser(updated);
  }

  @Delete("{id}")
  @Security("bearerAuth", ["ADMIN"])
  public async deleteUser(@Request() req: ExRequest, @Path() id: number) {
    const authUser = (req as any).user;
    if (authUser?.id === id) {
      this.setStatus(400);
      return { message: "Không thể tự xóa tài khoản đang đăng nhập." };
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
      },
    });

    if (!targetUser) {
      this.setStatus(404);
      return { message: "Không tìm thấy user." };
    }

    if (targetUser.role === Role.ADMIN) {
      const adminCount = await prisma.user.count({
        where: { role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        this.setStatus(400);
        return { message: "Không thể xóa admin cuối cùng." };
      }
    }

    await prisma.user.delete({
      where: { id },
    });

    return {
      id,
      message: "User deleted",
    };
  }
}
