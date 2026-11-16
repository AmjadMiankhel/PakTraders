import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { loadEnv } from "@paktenders/config";
import { PrismaService } from "../prisma/prisma.service";
import {
  IS_PUBLIC_KEY,
  type AuthUser,
  type AuthenticatedRequest,
} from "../decorators/auth.decorators";

interface AccessTokenPayload {
  sub: string;
  email: string;
  type: "access";
}

const env = loadEnv();

/**
 * Verifies the bearer token and loads the current user (with roles and
 * permissions) from PostgreSQL on every request. This keeps role changes and
 * account suspensions effective immediately instead of waiting for token
 * expiry.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.extractToken(request);
    if (!token) throw new UnauthorizedException("Authentication required");

    let payload: AccessTokenPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessTokenPayload>(token, {
        secret: env.JWT_ACCESS_SECRET,
      });
    } catch {
      throw new UnauthorizedException("Session expired or invalid");
    }
    if (payload.type !== "access") throw new UnauthorizedException("Invalid token type");

    const user = await this.prisma.client.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      include: {
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    if (!user) throw new UnauthorizedException("Account not found");
    if (user.status !== "ACTIVE") {
      throw new UnauthorizedException("Account is not active");
    }

    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      roles: user.roles.map((r) => r.role.code),
      permissions: Array.from(
        new Set(
          user.roles.flatMap((r) => r.role.permissions.map((p) => p.permission.code)),
        ),
      ),
    };

    request.user = authUser;
    return true;
  }

  private extractToken(request: AuthenticatedRequest): string | undefined {
    const header = request.headers.authorization;
    if (header?.startsWith("Bearer ")) return header.slice(7).trim();
    const cookieToken = (request.cookies as Record<string, string> | undefined)?.[
      "pt_access_token"
    ];
    return cookieToken || undefined;
  }
}
