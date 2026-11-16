import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  PERMISSIONS_KEY,
  ROLES_KEY,
  type AuthenticatedRequest,
} from "../decorators/auth.decorators";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if ((!requiredRoles || requiredRoles.length === 0) && (!requiredPermissions || requiredPermissions.length === 0)) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (!user) throw new ForbiddenException("Insufficient permissions");

    if (requiredRoles?.length && !requiredRoles.some((role) => user.roles.includes(role))) {
      throw new ForbiddenException("Insufficient role");
    }

    if (
      requiredPermissions?.length &&
      !requiredPermissions.every(
        (permission) =>
          user.permissions.includes(permission) || user.roles.includes("SUPER_ADMIN"),
      )
    ) {
      throw new ForbiddenException("Missing required permission");
    }

    return true;
  }
}
