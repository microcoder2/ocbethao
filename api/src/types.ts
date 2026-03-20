import type { Request } from "express";

export type AuthUser = {
  id: number;
  role: string;
  fullName: string;
};

export type RequestWithUser = Request & {
  user?: AuthUser;
};
