import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { PlatformStats } from "@paktenders/shared-types";
import { Public } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";

@ApiTags("stats")
@Public()
@Controller("stats")
export class StatsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Live platform statistics computed from the database" })
  async stats(): Promise<PlatformStats> {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);

    const publishedWhere = { deletedAt: null, status: "PUBLISHED" as const };

    const [publishedTenders, activeTenders, closingSoon, categories, departments, sources, demoRecords] =
      await this.prisma.client.$transaction([
        this.prisma.client.tender.count({ where: publishedWhere }),
        this.prisma.client.tender.count({
          where: { ...publishedWhere, closingAt: { gte: now } },
        }),
        this.prisma.client.tender.count({
          where: { ...publishedWhere, closingAt: { gte: now, lte: inSevenDays } },
        }),
        this.prisma.client.category.count({ where: { isActive: true } }),
        this.prisma.client.department.count({ where: { isActive: true } }),
        this.prisma.client.tenderSource.count(),
        this.prisma.client.tender.count({ where: { ...publishedWhere, isDemo: true } }),
      ]);

    return {
      publishedTenders,
      activeTenders,
      closingSoon,
      categories,
      departments,
      sources,
      demoRecords,
      generatedAt: new Date().toISOString(),
    };
  }
}
