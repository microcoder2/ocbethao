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
  username?: string | null;
  phone?: string | null;
  email?: string | null;
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

    if (body.username != null) {
      const trimmed = body.username.trim().toLowerCase();
      if (trimmed && !/^[a-z0-9_]{3,20}$/.test(trimmed)) {
        this.setStatus(400);
        return { message: "Tên đăng nhập chỉ gồm a-z, 0-9, dấu _ và 3–20 ký tự." };
      }
    }

    const data: Prisma.UserUpdateInput = {
      fullName: body.fullName,
      username: body.username != null ? (body.username.trim().toLowerCase() || null) : undefined,
      phone: body.phone != null ? (body.phone.trim() || null) : undefined,
      email: body.email != null ? (body.email.trim().toLowerCase() || null) : undefined,
    };
    if (body.password) {
      data.password = await bcrypt.hash(body.password, 10);
    }

    try {
      const updated = await prisma.user.update({
        where: { id: authUser.id },
        data,
        include: { authIdentities: true },
      });
      return serializeUser(updated);
    } catch (e: any) {
      if (e?.code === "P2002") {
        const fields: string[] = e?.meta?.target ?? [];
        this.setStatus(409);
        if (fields.includes("username")) return { message: "Tên đăng nhập đã được dùng bởi tài khoản khác." };
        if (fields.includes("phone"))    return { message: "Số điện thoại đã được dùng bởi tài khoản khác." };
        if (fields.includes("email"))    return { message: "Email đã được dùng bởi tài khoản khác." };
        return { message: "Thông tin đã tồn tại trong hệ thống." };
      }
      throw e;
    }
  }
}
