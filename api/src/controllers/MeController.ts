import {
  Body,
  Controller,
  Get,
  Put,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { serializeUser } from "../utils/mappers";

class UpdateMeBody {
  fullName!: string;
  phone?: string;
  email?: string;
  currentPassword?: string;
  password?: string;
}

@Route("me")
@Tags("Me")
export class MeController extends Controller {
  @Get("/")
  @Security("bearerAuth")
  public async me(@Request() req: ExRequest) {
    const authUser = (req as any).user;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
      include: {
        authIdentities: true,
      },
    });
    return serializeUser(user);
  }

  @Put("/")
  @Security("bearerAuth")
  public async updateMe(@Request() req: ExRequest, @Body() body: UpdateMeBody) {
    const authUser = (req as any).user;

    if (body.password) {
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: authUser.id },
        select: { password: true },
      });
      if (!user.password) {
        this.setStatus(400);
        return { message: "Tài khoản không có mật khẩu, không thể đổi." };
      }
      const match = await bcrypt.compare(body.currentPassword ?? "", user.password);
      if (!match) {
        this.setStatus(400);
        return { message: "Mật khẩu hiện tại không đúng." };
      }
    }

    const data: Prisma.UserUpdateInput = {
      fullName: body.fullName,
      phone: body.phone ?? null,
      email: body.email?.toLowerCase() ?? null,
    };
    if (body.password) {
      data.password = await bcrypt.hash(body.password, 10);
    }

    const updated = await prisma.user.update({
      where: { id: authUser.id },
      data,
      include: { authIdentities: true },
    });

    return serializeUser(updated);
  }
}
