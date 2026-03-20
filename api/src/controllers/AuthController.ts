import {
  Body,
  Controller,
  Delete,
  Example,
  Get,
  Path,
  Post,
  Query,
  Request,
  Response,
  Route,
  Security,
  SuccessResponse,
  Tags,
} from "tsoa";
import type { Request as ExRequest } from "express";
import { CustomerType } from "@prisma/client";
import {
  authenticateUser,
  AuthError,
  completeExternalAuth,
  getAuthProviderCatalog,
  getExternalAuthCallbackResult,
  linkExternalAuthIdentity,
  logoutSession,
  refreshTokens,
  registerCustomer,
  startExternalAuth,
  type ExternalAuthStartResponse,
  type LoginSuccessResponse,
  unlinkExternalAuthIdentity,
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

  @Example<string>("phone")
  provider!: string;

  @Example<string>("0909000999")
  identifier!: string;

  @Example<string>("123456")
  password!: string;

  @Example<CustomerType>(CustomerType.REGULAR)
  customerType?: CustomerType;
}

class ExternalAuthStartRequest {
  @Example<string>("login")
  intent?: string;

  @Example<string>("http://192.168.1.27:5174/auth/callback")
  redirectUri?: string;
}

class ExternalAuthCompleteRequest {
  @Example<string>("cf71a0b9d655d7")
  state?: string;

  @Example<string>("google-sub-123")
  providerUserId?: string;

  @Example<string>("customer@example.com")
  email?: string;

  @Example<string>("0909000999")
  phone?: string;

  @Example<string>("khachmoi")
  username?: string;

  @Example<string>("Khach Moi")
  fullName?: string;

  @Example<string>("https://cdn.example/avatar.jpg")
  avatarUrl?: string;

  emailVerified?: boolean;
  phoneVerified?: boolean;
  code?: string;
  idToken?: string;
  rawProfile?: Record<string, unknown>;
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

  @Get("providers")
  public async getProviders() {
    return getAuthProviderCatalog();
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
      const result = await authenticateUser(identifier, body.password, req);
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

  @Post("external/{provider}/start")
  @SuccessResponse("200", "Challenge created")
  public async startExternal(
    @Path() provider: string,
    @Request() req: ExRequest,
    @Body() body: ExternalAuthStartRequest
  ): Promise<ExternalAuthStartResponse | MessageResponse> {
    try {
      const authUser = (req as any).user;
      return await startExternalAuth(provider, body, req, authUser?.id);
    } catch (error) {
      if (error instanceof AuthError) {
        this.setStatus(error.status);
        return { message: error.message };
      }
      this.setStatus(500);
      return { message: "Unable to start external auth" };
    }
  }

  @Get("external/{provider}/callback")
  public async externalCallback(
    @Path() provider: string,
    @Query() state?: string,
    @Query() code?: string,
    @Query() error?: string
  ) {
    return getExternalAuthCallbackResult(provider, { state, code, error });
  }

  @Post("external/{provider}/complete")
  @SuccessResponse("200", "External login successful")
  public async completeExternal(
    @Path() provider: string,
    @Request() req: ExRequest,
    @Body() body: ExternalAuthCompleteRequest
  ): Promise<LoginSuccessResponse | MessageResponse> {
    try {
      const result = await completeExternalAuth(
        provider,
        { ...body, rawProfile: body.rawProfile as any },
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
      return { message: "External auth failed" };
    }
  }

  @Post("link/{provider}")
  @Security("bearerAuth")
  public async linkProvider(
    @Path() provider: string,
    @Request() req: ExRequest,
    @Body() body: ExternalAuthCompleteRequest
  ) {
    const authUser = (req as any).user;
    return linkExternalAuthIdentity(
      authUser.id,
      provider,
      { ...body, rawProfile: body.rawProfile as any },
      req
    );
  }

  @Delete("link/{provider}/{identityId}")
  @Security("bearerAuth")
  public async unlinkProvider(
    @Path() provider: string,
    @Path() identityId: number,
    @Request() req: ExRequest
  ) {
    const authUser = (req as any).user;
    return unlinkExternalAuthIdentity(authUser.id, provider, identityId, req);
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
