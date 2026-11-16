import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { SubscriptionPlanDto } from "@paktenders/shared-types";
import { Public } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";

@ApiTags("plans")
@Public()
@Controller("plans")
export class PlansController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Active subscription plans (prices are configurable in admin)" })
  async list(): Promise<SubscriptionPlanDto[]> {
    const rows = await this.prisma.client.subscriptionPlan.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });

    return rows.map((plan) => ({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description,
      pricePkr: plan.pricePkr.toString(),
      interval: plan.interval,
      features: (plan.features ?? {}) as Record<string, unknown>,
      chatbotQuota: plan.chatbotQuota,
      savedTenderLimit: plan.savedTenderLimit,
      isPopular: plan.isPopular,
      sortOrder: plan.sortOrder,
    }));
  }
}
