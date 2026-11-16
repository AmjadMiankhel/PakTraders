import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../common/prisma/prisma.service";

/**
 * Daily reconciliation jobs:
 *  - close published tenders whose closing date has passed;
 *  - reset the schedule of every enabled automated source so the full source
 *    registry is re-checked at least once per day.
 */
@Injectable()
export class CollectionSchedulerService {
  private readonly logger = new Logger(CollectionSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  async reconcileDeadlines(): Promise<{ closed: number }> {
    const now = new Date();
    const rows = await this.prisma.client.tender.findMany({
      where: { status: "PUBLISHED", closingAt: { lt: now }, deletedAt: null },
      select: { id: true },
      take: 1000,
    });

    let closed = 0;
    for (const row of rows) {
      try {
        await this.prisma.client.tender.update({
          where: { id: row.id },
          data: {
            status: "CLOSED",
            statusHistory: {
              create: {
                fromStatus: "PUBLISHED",
                toStatus: "CLOSED",
                reason: "Closing date passed (automatic reconciliation).",
              },
            },
          },
        });
        closed += 1;
      } catch (error) {
        this.logger.warn(
          `Could not close tender ${row.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    if (closed > 0) this.logger.log(`Closed ${closed} tender(s) whose closing date passed.`);
    return { closed };
  }

  async reconcileSources(): Promise<string[]> {
    const rows = await this.prisma.client.tenderSource.findMany({
      where: {
        isEnabled: true,
        status: "ACTIVE",
        connectorKey: { not: "manual" },
        collectionMethod: { not: "MANUAL_IMPORT" },
      },
      select: { id: true, nextRunAt: true },
    });
    const now = Date.now();
    const ids: string[] = [];
    for (const row of rows) {
      if (!row.nextRunAt || row.nextRunAt.getTime() > now + 24 * 3600_000) {
        await this.prisma.client.tenderSource.update({
          where: { id: row.id },
          data: { nextRunAt: new Date() },
        });
      }
      ids.push(row.id);
    }
    this.logger.log(`Full source reconciliation scheduled for ${ids.length} source(s).`);
    return ids;
  }
}
