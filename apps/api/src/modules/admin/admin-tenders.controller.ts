import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import {
  createTenderSchema,
  tenderSearchSchema,
  updateTenderSchema,
} from "@paktenders/validation";
import {
  CurrentUser,
  RequirePermissions,
  Roles,
  type AuthUser,
} from "../../common/decorators/auth.decorators";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { AdminService } from "./admin.service";
import { TendersService } from "../tenders/tenders.service";

const statusSchema = z.object({
  status: z.enum(["DRAFT", "PENDING_VERIFICATION", "PUBLISHED", "CLOSED", "CANCELLED", "ARCHIVED"]),
  reason: z.string().max(500).optional(),
});

const verifySchema = z.object({
  status: z.enum(["VERIFIED", "PENDING", "UNVERIFIED"]),
  notes: z.string().max(1000).optional(),
});

const adminListSchema = tenderSearchSchema.extend({
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED", "DEMO"]).optional(),
  includeDeleted: z.coerce.boolean().optional(),
});

@ApiTags("admin-tenders")
@ApiBearerAuth()
@Roles("SUPER_ADMIN", "ADMIN", "TENDER_MANAGER", "RESEARCHER", "VERIFICATION_OFFICER")
@Controller("admin/tenders")
export class AdminTendersController {
  constructor(
    private readonly tenders: TendersService,
    private readonly admin: AdminService,
  ) {}

  @Get()
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "List tenders of every status for administration" })
  list(@Query(new ZodValidationPipe(adminListSchema)) query: z.infer<typeof adminListSchema>) {
    return this.tenders.adminList(query);
  }

  @Post()
  @RequirePermissions("tender.create")
  @ApiOperation({ summary: "Create a tender record" })
  async create(
    @CurrentUser() actor: AuthUser,
    @Body(new ZodValidationPipe(createTenderSchema)) body: z.infer<typeof createTenderSchema>,
  ) {
    const created = await this.tenders.create(body, actor.id);
    await this.admin.audit(actor.id, "tender.create", "Tender", created.id, {
      to: { title: created.title, status: created.status },
    });
    return created;
  }

  @Get(":id")
  @RequirePermissions("tender.read")
  @ApiOperation({ summary: "Fetch a tender by id (any status)" })
  detail(@Param("id") id: string) {
    return this.tenders.adminDetail(id);
  }

  @Patch(":id")
  @RequirePermissions("tender.update")
  @ApiOperation({ summary: "Update a tender record" })
  async update(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(updateTenderSchema)) body: z.infer<typeof updateTenderSchema>,
  ) {
    const updated = await this.tenders.update(id, body, actor.id);
    await this.admin.audit(actor.id, "tender.update", "Tender", id, {
      to: { title: updated.title, status: updated.status },
    });
    return updated;
  }

  @Post(":id/status")
  @RequirePermissions("tender.publish")
  @ApiOperation({ summary: "Publish, close, cancel or archive a tender" })
  async setStatus(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(statusSchema)) body: z.infer<typeof statusSchema>,
  ) {
    const updated = await this.tenders.setStatus(id, body.status, actor.id, body.reason);
    await this.admin.audit(actor.id, "tender.status", "Tender", id, {
      to: { status: body.status, reason: body.reason },
    });
    return updated;
  }

  @Post(":id/verify")
  @RequirePermissions("tender.verify")
  @ApiOperation({ summary: "Record a verification decision" })
  async verify(
    @CurrentUser() actor: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(verifySchema)) body: { status: "VERIFIED" | "PENDING" | "UNVERIFIED"; notes?: string },
  ) {
    const updated = await this.tenders.verify(id, body.status, actor.id, body.notes);
    await this.admin.audit(actor.id, "tender.verify", "Tender", id, { to: { status: body.status } });
    return updated;
  }

  @Delete(":id")
  @RequirePermissions("tender.delete")
  @ApiOperation({ summary: "Soft-delete a tender (audited)" })
  remove(@CurrentUser() actor: AuthUser, @Param("id") id: string) {
    return this.tenders.softDelete(id, actor.id);
  }
}
