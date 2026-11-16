import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { alertRuleSchema, saveSearchSchema, updateProfileSchema } from "@paktenders/validation";
import { CurrentUser, type AuthUser } from "../../common/decorators/auth.decorators";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MeService } from "./me.service";

const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  language: z.enum(["en", "ur"]).optional(),
  pushEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  digestFrequency: z.enum(["INSTANT", "DAILY", "WEEKLY"]).optional(),
  whatsappEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  quietHoursStart: z.coerce.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.coerce.number().int().min(0).max(23).nullable().optional(),
});

const markReadSchema = z.object({ ids: z.array(z.uuid()).optional() });
const deleteAccountSchema = z.object({ confirmation: z.string() });
const toggleAlertSchema = z.object({ isActive: z.boolean() });

@ApiTags("me")
@ApiBearerAuth()
@Controller("me")
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get("profile")
  @ApiOperation({ summary: "Full profile, preferences and active subscription" })
  profile(@CurrentUser() user: AuthUser) {
    return this.me.profile(user.id);
  }

  @Patch("profile")
  @ApiOperation({ summary: "Update profile details" })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: z.infer<typeof updateProfileSchema>,
  ) {
    return this.me.updateProfile(user.id, body);
  }

  @Patch("preferences")
  @ApiOperation({ summary: "Update theme, language and notification preferences" })
  preferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(preferencesSchema)) body: z.infer<typeof preferencesSchema>,
  ) {
    return this.me.updatePreferences(user.id, body);
  }

  @Get("saved-tenders")
  @ApiOperation({ summary: "Tenders saved by the current user" })
  savedTenders(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.me.savedTenders(
      user.id,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 20)),
    );
  }

  @Post("saved-tenders/:tenderId")
  @ApiOperation({ summary: "Save a tender (synced across all platforms)" })
  saveTender(@CurrentUser() user: AuthUser, @Param("tenderId") tenderId: string) {
    return this.me.saveTender(user.id, tenderId);
  }

  @Delete("saved-tenders/:tenderId")
  @ApiOperation({ summary: "Remove a saved tender" })
  unsaveTender(@CurrentUser() user: AuthUser, @Param("tenderId") tenderId: string) {
    return this.me.unsaveTender(user.id, tenderId);
  }

  @Get("saved-searches")
  @ApiOperation({ summary: "Saved searches for the current user" })
  savedSearches(@CurrentUser() user: AuthUser) {
    return this.me.savedSearches(user.id);
  }

  @Post("saved-searches")
  @ApiOperation({ summary: "Save the current search filters" })
  createSavedSearch(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(saveSearchSchema)) body: z.infer<typeof saveSearchSchema>,
  ) {
    return this.me.createSavedSearch(user.id, body.name, body.queryJson);
  }

  @Delete("saved-searches/:id")
  @ApiOperation({ summary: "Delete a saved search" })
  deleteSavedSearch(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.me.deleteSavedSearch(user.id, id);
  }

  @Get("alerts")
  @ApiOperation({ summary: "Alert rules for the current user" })
  alerts(@CurrentUser() user: AuthUser) {
    return this.me.alerts(user.id);
  }

  @Post("alerts")
  @ApiOperation({ summary: "Create a personalized alert rule" })
  createAlert(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(alertRuleSchema)) body: z.infer<typeof alertRuleSchema>,
  ) {
    return this.me.createAlert(user.id, body);
  }

  @Patch("alerts/:id")
  @ApiOperation({ summary: "Enable or disable an alert" })
  toggleAlert(
    @CurrentUser() user: AuthUser,
    @Param("id") id: string,
    @Body(new ZodValidationPipe(toggleAlertSchema)) body: { isActive: boolean },
  ) {
    return this.me.toggleAlert(user.id, id, body.isActive);
  }

  @Delete("alerts/:id")
  @ApiOperation({ summary: "Delete an alert rule" })
  deleteAlert(@CurrentUser() user: AuthUser, @Param("id") id: string) {
    return this.me.deleteAlert(user.id, id);
  }

  @Get("notifications")
  @ApiOperation({ summary: "In-app notifications with unread count" })
  notifications(
    @CurrentUser() user: AuthUser,
    @Query("page") page?: string,
    @Query("pageSize") pageSize?: string,
  ) {
    return this.me.notifications(
      user.id,
      Math.max(1, Number(page) || 1),
      Math.min(100, Math.max(1, Number(pageSize) || 30)),
    );
  }

  @Patch("notifications/read")
  @ApiOperation({ summary: "Mark notifications as read" })
  markRead(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(markReadSchema)) body: { ids?: string[] },
  ) {
    return this.me.markNotificationsRead(user.id, body.ids);
  }

  @Get("subscription")
  @ApiOperation({ summary: "Current subscription and entitlements" })
  subscription(@CurrentUser() user: AuthUser) {
    return this.me.subscription(user.id);
  }

  @Get("invoices")
  @ApiOperation({ summary: "Invoice history" })
  invoices(@CurrentUser() user: AuthUser) {
    return this.me.invoices(user.id);
  }

  @Delete("account")
  @ApiOperation({ summary: "Request account deletion (irreversible)" })
  deleteAccount(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(deleteAccountSchema)) body: { confirmation: string },
  ) {
    return this.me.deleteAccount(user.id, body.confirmation);
  }
}
