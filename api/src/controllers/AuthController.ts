import {
  Body,
  Controller,
  Example,
  Post,
  Request,
  Response,
  Route,
  SuccessResponse,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";
import { AuthProvider, CustomerType } from "@prisma/client";
import {
  authenticateUser,
  AuthError,
  logoutSession,
  refreshTokens,
  registerCustomer,
  type LoginSuccessResponse,
} from "../services/authService";

class LoginRequest {
  @Example<string>("admin")
  username?: string;

  @Example<string>("0909000003")
  identifier?: string;

  @Example<string>("123456")
  password!: string;
}

class RegisterCustomerRequest {
  @Example<string>("Khach Moi")
  fullName!: string;

  @Example<AuthProvider>(AuthProvider.PHONE)
  provider!: AuthProvider;

  @Example<string>("0909000999")
  identifier!: string;

  @Example<string>("123456")
  password!: string;

  @Example<CustomerType>(CustomerType.REGULAR)
  customerType?: CustomerType;
}

type MessageResponse = { message: string };

@Route("auth")
@Tags("Auth")
export class AuthController extends Controller {
  private setRefreshCookie(token: string | null): void {
    const maxAgeMs = Number(
      process.env.REFRESH_COOKIE_MAX_AGE_MS || 7 * 24 * 60 * 60 * 1000
    );
    const isProd = process.env.NODE_ENV === "production";
    const cookie = [
      `refreshToken=${encodeURIComponent(token || "")}`,
      "Path=/api/auth",
      "HttpOnly",
      "SameSite=Lax",
    ];
    if (isProd) cookie.push("Secure");
    cookie.push(token ? `Max-Age=${Math.floor(maxAgeMs / 1000)}` : "Max-Age=0");
    this.setHeader("Set-Cookie", cookie.join("; "));
  }

  @Post("login")
  @SuccessResponse("200", "Login successful")
  @Response<MessageResponse>(401, "Invalid credentials")
  public async login(
    @Request() req: ExRequest,
    @Body() body: LoginRequest
  ): Promise<LoginSuccessResponse | MessageResponse> {
    try {
      const identifier = String(body.username || body.identifier || "").trim();
      const result = await authenticateUser(
        identifier,
        body.password,
        req
      );
      if (result.refreshToken) {
        this.setRefreshCookie(result.refreshToken);
      }
      const { refreshToken, ...safe } = result;
      return safe;
    } catch (error) {
      if (error instanceof AuthError) {
        this.setStatus(error.status);
        return { message: error.message };
      }
      this.setStatus(500);
      return { message: "Login failed" };
    }
  }

  @Post("register-customer")
  @SuccessResponse("201", "Customer registered")
  @Response<MessageResponse>(409, "Account already exists")
  public async registerCustomer(
    @Request() req: ExRequest,
    @Body() body: RegisterCustomerRequest
  ): Promise<LoginSuccessResponse | MessageResponse> {
    try {
      const result = await registerCustomer(body, req);
      if (result.refreshToken) {
        this.setRefreshCookie(result.refreshToken);
      }
      const { refreshToken, ...safe } = result;
      this.setStatus(201);
      return safe;
    } catch (error) {
      if (error instanceof AuthError) {
        this.setStatus(error.status);
        return { message: error.message };
      }
      this.setStatus(500);
      return { message: "Register failed" };
    }
  }

  @Post("refresh")
  @SuccessResponse("200", "Refreshed")
  @Response<MessageResponse>(401, "Invalid refresh token")
  public async refresh(
    @Request() req: ExRequest,
    @Body() body?: { refreshToken?: string }
  ): Promise<LoginSuccessResponse | MessageResponse> {
    try {
      const token = (req as any).cookies?.refreshToken || body?.refreshToken || "";
      const result = await refreshTokens(token, req);
      if (result.refreshToken) {
        this.setRefreshCookie(result.refreshToken);
      }
      const { refreshToken, ...safe } = result;
      return safe;
    } catch (error) {
      if (error instanceof AuthError) {
        this.setStatus(error.status);
        return { message: error.message };
      }
      this.setStatus(500);
      return { message: "Refresh failed" };
    }
  }

  @Post("logout")
  @SuccessResponse("200", "Logged out")
  public async logout(@Request() req: ExRequest): Promise<MessageResponse> {
    const token = (req as any).cookies?.refreshToken || "";
    await logoutSession(token, req);
    this.setRefreshCookie(null);
    return { message: "Logged out" };
  }
}
