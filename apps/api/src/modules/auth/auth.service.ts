import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import { loadEnv } from "@paktenders/config";
import type { AuthSession, AuthUser } from "@paktenders/shared-types";
import { parseDurationSeconds } from "@paktenders/shared-utils";
import type { LoginInput, RegisterInput } from "@paktenders/validation";
import { PrismaService } from "../../common/prisma/prisma.service";

const env = loadEnv();

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: RegisterInput, meta: { userAgent?: string; ip?: string }): Promise<AuthSession> {
    const existing = await this.prisma.client.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException("An account with this email already exists");

    const userRole = await this.prisma.client.role.findUnique({ where: { code: "USER" } });
    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });

    const user = await this.prisma.client.user.create({
      data: {
        email: input.email,
        fullName: input.fullName,
        phone: input.phone || null,
        passwordHash,
        // Email verification is enforced once a transactional email provider is
        // configured (Phase 5). Until then accounts are usable immediately.
        status: "ACTIVE",
        profile: { create: {} },
        preference: { create: {} },
        notificationPref: { create: {} },
        ...(userRole ? { roles: { create: { roleId: userRole.id } } } : {}),
      },
      include: this.userInclude,
    });

    const tokens = await this.issueTokens(user.id, user.email, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async login(input: LoginInput, meta: { userAgent?: string; ip?: string }): Promise<AuthSession> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: input.email },
      include: this.userInclude,
    });

    if (!user || user.deletedAt) {
      throw new UnauthorizedException("Invalid email or password");
    }
    if (user.status === "SUSPENDED" || user.status === "DELETED") {
      throw new UnauthorizedException("This account is not available");
    }

    const valid = await argon2.verify(user.passwordHash, input.password);
    if (!valid) throw new UnauthorizedException("Invalid email or password");

    await this.prisma.client.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.issueTokens(user.id, user.email, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(refreshToken: string, meta: { userAgent?: string; ip?: string }): Promise<AuthSession> {
    const hash = sha256(refreshToken);
    const session = await this.prisma.client.session.findUnique({
      where: { refreshTokenHash: hash },
      include: { user: { include: this.userInclude } },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or expired");
    }
    if (session.user.status !== "ACTIVE" || session.user.deletedAt) {
      throw new UnauthorizedException("This account is not available");
    }

    // Rotate: revoke the presented token and issue a fresh pair.
    await this.prisma.client.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: session.userId },
      include: this.userInclude,
    });
    const tokens = await this.issueTokens(user.id, user.email, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async logout(refreshToken: string): Promise<{ success: boolean }> {
    if (refreshToken) {
      await this.prisma.client.session.updateMany({
        where: { refreshTokenHash: sha256(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { success: true };
  }

  async logoutAll(userId: string): Promise<{ success: boolean }> {
    await this.prisma.client.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  /**
   * Issues a password-reset token. Returns a generic response either way so the
   * endpoint cannot be used to enumerate accounts. Until an email provider is
   * configured the reset link is written to the server log (development only).
   */
  async requestPasswordReset(email: string): Promise<{ success: true }> {
    const user = await this.prisma.client.user.findUnique({ where: { email } });
    if (user && user.deletedAt === null) {
      const token = await this.jwt.signAsync(
        { sub: user.id, type: "password_reset", ph: sha256(user.passwordHash).slice(0, 16) },
        { secret: env.JWT_REFRESH_SECRET, expiresIn: "30m" },
      );
      const link = `${env.SITE_URL}/reset-password?token=${token}`;
      if (env.NODE_ENV !== "production") {
        this.logger.log(`Password reset link (dev only): ${link}`);
      }
      // TODO(Phase 5): send via configured transactional email provider.
    }
    return { success: true };
  }

  async resetPassword(token: string, password: string): Promise<{ success: true }> {
    let payload: { sub: string; type: string; ph: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: env.JWT_REFRESH_SECRET });
    } catch {
      throw new BadRequestException("This reset link is invalid or has expired");
    }
    if (payload.type !== "password_reset") {
      throw new BadRequestException("This reset link is invalid");
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.deletedAt) throw new BadRequestException("This reset link is invalid");
    if (sha256(user.passwordHash).slice(0, 16) !== payload.ph) {
      throw new BadRequestException("This reset link has already been used");
    }

    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await this.prisma.client.$transaction([
      this.prisma.client.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.client.session.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { success: true };
  }

  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: this.userInclude,
    });
    return this.toAuthUser(user);
  }

  private async issueTokens(
    userId: string,
    email: string,
    meta: { userAgent?: string; ip?: string },
  ): Promise<AuthSession["tokens"]> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, type: "access" },
      { secret: env.JWT_ACCESS_SECRET, expiresIn: parseDurationSeconds(env.JWT_ACCESS_TTL) },
    );

    const refreshToken = randomBytes(48).toString("base64url");
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);

    await this.prisma.client.session.create({
      data: {
        userId,
        refreshTokenHash: sha256(refreshToken),
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ip?.slice(0, 64),
      },
    });

    // Housekeeping: drop expired sessions for this user.
    await this.prisma.client.session.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: parseDurationSeconds(env.JWT_ACCESS_TTL),
    };
  }

  private readonly userInclude = {
    roles: {
      include: {
        role: {
          include: { permissions: { include: { permission: true } } },
        },
      },
    },
  } as const;

  private toAuthUser(user: {
    id: string;
    email: string;
    fullName: string;
    status: string;
    emailVerifiedAt: Date | null;
    roles: Array<{
      role: {
        code: string;
        permissions: Array<{ permission: { code: string } }>;
      };
    }>;
  }): AuthUser {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      roles: user.roles.map((r) => r.role.code),
      permissions: Array.from(
        new Set(user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code))),
      ),
    };
  }
}
