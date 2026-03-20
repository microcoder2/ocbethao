import {
  Controller,
  Get,
  Request,
  Route,
  Security,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";
import { prisma } from "../utils/prisma";
import { serializeUser } from "../utils/mappers";

@Route("me")
@Tags("Me")
export class MeController extends Controller {
  @Get("/")
  @Security("bearerAuth")
  public async me(@Request() req: ExRequest) {
    const authUser = (req as any).user;
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: authUser.id },
    });
    return serializeUser(user);
  }
}
