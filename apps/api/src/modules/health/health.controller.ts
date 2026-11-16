import { Controller, Get } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Public } from "../../common/decorators/auth.decorators";
import { PrismaService } from "../../common/prisma/prisma.service";

@ApiTags("health")
@Public()
@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: "Liveness and database connectivity probe" })
  async health() {
    const dbOk = await this.prisma.ping();
    return {
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "unreachable",
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }
}
