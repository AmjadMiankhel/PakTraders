import { Body, Controller, Get, HttpCode, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Request } from "express";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  type LoginInput,
  type RegisterInput,
} from "@paktenders/validation";
import { z } from "zod";
import { CurrentUser, Public, type AuthUser } from "../../common/decorators/auth.decorators";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AuthService } from "./auth.service";

const refreshSchema = z.object({ refreshToken: z.string().min(20) });

@ApiTags("auth")
@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  @Throttle({ auth: { limit: 6, ttl: 60_000 } })
  @ApiOperation({ summary: "Create an account and return tokens" })
  register(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
    @Req() req: Request,
  ) {
    return this.auth.register(body, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
  }

  @Public()
  @Post("login")
  @HttpCode(200)
  @Throttle({ auth: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: "Authenticate with email and password" })
  login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Req() req: Request,
  ) {
    return this.auth.login(body, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
  }

  @Public()
  @Post("refresh")
  @HttpCode(200)
  @ApiOperation({ summary: "Rotate a refresh token and issue a new access token" })
  refresh(
    @Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string },
    @Req() req: Request,
  ) {
    return this.auth.refresh(body.refreshToken, {
      userAgent: req.headers["user-agent"],
      ip: req.ip,
    });
  }

  @Public()
  @Post("logout")
  @HttpCode(200)
  @ApiOperation({ summary: "Revoke a refresh token" })
  logout(@Body(new ZodValidationPipe(refreshSchema)) body: { refreshToken: string }) {
    return this.auth.logout(body.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Request a password reset link (generic response)" })
  forgotPassword(@Body(new ZodValidationPipe(forgotPasswordSchema)) body: { email: string }) {
    return this.auth.requestPasswordReset(body.email);
  }

  @Public()
  @Post("reset-password")
  @HttpCode(200)
  @Throttle({ auth: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: "Set a new password using a reset token" })
  resetPassword(
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: { token: string; password: string },
  ) {
    return this.auth.resetPassword(body.token, body.password);
  }

  @Get("me")
  @ApiBearerAuth()
  @ApiOperation({ summary: "Return the authenticated user" })
  me(@CurrentUser() user: AuthUser) {
    return this.auth.me(user.id);
  }

  @Post("logout-all")
  @HttpCode(200)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Revoke every session for the current user" })
  logoutAll(@CurrentUser() user: AuthUser) {
    return this.auth.logoutAll(user.id);
  }
}
