import { Body, Controller, Get, Param, Patch, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  CurrentUser,
  RequirePermissions,
  Roles,
  type AuthUser,
} from "../../common/decorators/auth.decorators";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AdminService } from "./admin.service";

const updateSettingSchema = z.object({
  key: z.string().min(1).max(120),
  value: z.unknown(),
});

const userStatusSchema = z.object({ status: z.enum(["ACTIVE", "SUSPENDED"]) });

@ApiTags("admin")
@ApiBearerAuth()
@Roles("SUPER_ADMIN", "ADMIN", "TENDER_MANAGER", "FINANCE_MANAGER", "TECHNICAL_ADMIN", "CONTENT_MANAGER", "SEO_MANAGER", "CUSTOMER_SUPPORT", "VERIFICATION_OFFICER", "AI_MANAGER", "NOTIFICATION_MANAGER", "RESEARCHER")
@Controller("admin")
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("overview")
  @RequirePermissions("audit.read")
  @ApiOperation({ summary: "Live platform overview for the control center" })
  overview() {
    return this.admin.overview();
  }

  @Get("users")
  @RequirePermissions("user.read")
  @ApiOperation({ summary: "Search and page through user accounts" })
  users(
    @Query("q") q?: string,
    @Query("status") status?: string,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.admin.users({
      q,
      status,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    });
  }

  @Patch("users/:id/status")
  @RequirePermissions("user.suspend")
  @ApiOperation({ summary: "Activate or suspend a user account" })
  setUserStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(userStatusSchema)) body: { status: "ACTIVE" | "SUSPENDED" },
  ) {
    return this.admin.setUserStatus(actor.id, id, body.status);
  }

  @Get("settings")
  @RequirePermissions("system.settings")
  @ApiOperation({ summary: "All platform settings" })
  settings() {
    return this.admin.settings();
  }

  @Patch("settings")
  @RequirePermissions("system.settings")
  @ApiOperation({ summary: "Update one platform setting (audited)" })
  updateSetting(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(updateSettingSchema)) body: { key: string; value: unknown },
  ) {
    return this.admin.updateSetting(actor.id, body.key, body.value);
  }

  @Get("integrations")
  @RequirePermissions("integration.manage")
  @ApiOperation({ summary: "Integration status (secrets are never returned)" })
  integrations() {
    return this.admin.integrations();
  }

  @Get("audit-logs")
  @RequirePermissions("audit.read")
  @ApiOperation({ summary: "Immutable admin action log" })
  auditLogs(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.admin.auditLogs(
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 30)),
    );
  }

  @Get("health")
  @RequirePermissions("system.health")
  @ApiOperation({ summary: "Detailed system health for technical administrators" })
  health() {
    return this.admin.health();
  }
}
