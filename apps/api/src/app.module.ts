import { Module, type ExecutionContext } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ThrottlerModule, ThrottlerGuard } from "@nestjs/throttler";
import { APP_GUARD } from "@nestjs/core";
import { loadEnv } from "@paktenders/config";
import { parseDurationSeconds } from "@paktenders/shared-utils";
import { PrismaModule } from "./common/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { TendersModule } from "./modules/tenders/tenders.module";
import { CatalogModule } from "./modules/catalog/catalog.module";
import { StatsModule } from "./modules/stats/stats.module";
import { PlansModule } from "./modules/plans/plans.module";
import { MeModule } from "./modules/me/me.module";
import { AdminModule } from "./modules/admin/admin.module";
import { CollectionModule } from "./modules/collection/collection.module";
import { HealthModule } from "./modules/health/health.module";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";

const env = loadEnv();

/**
 * The website's server-side renders call the API from a single host, so their
 * requests would otherwise share one per-IP rate-limit bucket. When a shared
 * internal key is configured, those calls skip public throttling. Auth routes
 * still apply their stricter limits to real client traffic.
 */
function isInternalRequest(context: ExecutionContext): boolean {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return false;
  const request = context.switchToHttp().getRequest<{ headers?: Record<string, unknown> }>();
  return request.headers?.["x-internal-key"] === key;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
    }),
    JwtModule.register({
      global: true,
      secret: env.JWT_ACCESS_SECRET,
      signOptions: { expiresIn: parseDurationSeconds(env.JWT_ACCESS_TTL) },
    }),
    ThrottlerModule.forRoot([
      { name: "default", ttl: 60_000, limit: 180, skipIf: isInternalRequest },
      { name: "auth", ttl: 60_000, limit: 12, skipIf: isInternalRequest },
    ]),
    PrismaModule,
    AuthModule,
    TendersModule,
    CatalogModule,
    StatsModule,
    PlansModule,
    MeModule,
    AdminModule,
    CollectionModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
