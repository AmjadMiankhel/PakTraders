import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import type { Prisma } from "@paktenders/database";
import { PrismaService } from "../../common/prisma/prisma.service";

const env = loadEnv();

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const inSevenDays = new Date(now.getTime() + 7 * 86_400_000);
    const dayAgo = new Date(now.getTime() - 86_400_000);

    const [
      totalTenders,
      activeTenders,
      closingSoon,
      closedTenders,
      pendingVerification,
      demoRecords,
      totalUsers,
      activeUsers,
      companies,
      paidSubscribers,
      revenue,
      pendingPayments,
      failedPayments,
      refundRequests,
      conversations,
      notificationsSent,
      notificationsFailed,
      errorCount,
      recentAudit,
    ] = await this.prisma.client.$transaction([
      this.prisma.client.tender.count({ where: { deletedAt: null } }),
      this.prisma.client.tender.count({
        where: { deletedAt: null, status: "PUBLISHED", closingAt: { gte: now } },
      }),
      this.prisma.client.tender.count({
        where: { deletedAt: null, status: "PUBLISHED", closingAt: { gte: now, lte: inSevenDays } },
      }),
      this.prisma.client.tender.count({ where: { deletedAt: null, status: "CLOSED" } }),
      this.prisma.client.tender.count({
        where: { deletedAt: null, status: { in: ["PENDING_VERIFICATION", "DRAFT"] } },
      }),
      this.prisma.client.tender.count({ where: { isDemo: true } }),
      this.prisma.client.user.count({ where: { deletedAt: null } }),
      this.prisma.client.user.count({ where: { deletedAt: null, status: "ACTIVE" } }),
      this.prisma.client.company.count({ where: { deletedAt: null } }),
      this.prisma.client.subscription.count({ where: { status: { in: ["ACTIVE", "TRIAL"] } } }),
      this.prisma.client.payment.aggregate({
        _sum: { amountPkr: true },
        where: { status: "VERIFIED" },
      }),
      this.prisma.client.payment.count({ where: { status: "PENDING" } }),
      this.prisma.client.payment.count({ where: { status: "FAILED" } }),
      this.prisma.client.refund.count({ where: { status: "REQUESTED" } }),
      this.prisma.client.chatbotConversation.count(),
      this.prisma.client.notificationDeliveryLog.count({
        where: { status: { in: ["SENT", "DELIVERED"] }, attemptedAt: { gte: dayAgo } },
      }),
      this.prisma.client.notificationDeliveryLog.count({
        where: { status: "FAILED", attemptedAt: { gte: dayAgo } },
      }),
      this.prisma.client.errorLog.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.client.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    return {
      tenders: {
        total: totalTenders,
        active: activeTenders,
        closingSoon,
        closed: closedTenders,
        pendingVerification,
        demoRecords,
      },
      users: { total: totalUsers, active: activeUsers, companies, paidSubscribers },
      finance: {
        revenuePkr: revenue._sum.amountPkr?.toString() ?? "0",
        pendingPayments,
        failedPayments,
        refundRequests,
      },
      engagement: { chatbotConversations: conversations },
      system: {
        notificationsSent24h: notificationsSent,
        notificationsFailed24h: notificationsFailed,
        errors24h: errorCount,
      },
      recentActivity: recentAudit.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId,
        actorEmail: log.actorEmail,
        createdAt: log.createdAt.toISOString(),
      })),
      generatedAt: new Date().toISOString(),
    };
  }

  async users(params: { q?: string; status?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, params.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 20));

    const where: Prisma.UserWhereInput = {
      ...(params.status ? { status: params.status as never } : {}),
      ...(params.q
        ? {
            OR: [
              { email: { contains: params.q, mode: "insensitive" } },
              { fullName: { contains: params.q, mode: "insensitive" } },
              { phone: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.user.count({ where }),
      this.prisma.client.user.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          roles: { include: { role: { select: { code: true, name: true } } } },
          subscriptions: {
            where: { status: { in: ["ACTIVE", "TRIAL"] } },
            include: { plan: { select: { name: true, code: true } } },
            take: 1,
          },
        },
      }),
    ]);

    return {
      items: rows.map((user) => ({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        status: user.status,
        emailVerified: Boolean(user.emailVerifiedAt),
        createdAt: user.createdAt.toISOString(),
        lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
        roles: user.roles.map((r) => r.role.code),
        plan: user.subscriptions[0]?.plan.name ?? null,
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async setUserStatus(actorId: string, userId: string, status: "ACTIVE" | "SUSPENDED") {
    if (actorId === userId) {
      throw new BadRequestException("You cannot change your own account status");
    }
    const target = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!target || target.deletedAt) throw new NotFoundException("User not found");

    const actor = await this.prisma.client.user.findUnique({
      where: { id: actorId },
      include: { roles: { include: { role: true } } },
    });
    const actorIsSuperAdmin = actor?.roles.some((r) => r.role.code === "SUPER_ADMIN") ?? false;
    const targetIsSuperAdmin = target.roles.some((r) => r.role.code === "SUPER_ADMIN");
    if (targetIsSuperAdmin && !actorIsSuperAdmin) {
      throw new ForbiddenException("Only a Super Admin can modify another Super Admin");
    }

    await this.prisma.client.user.update({ where: { id: userId }, data: { status } });
    if (status === "SUSPENDED") {
      await this.prisma.client.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit(actorId, "user.status.update", "User", userId, {
      from: target.status,
      to: status,
    });

    return { success: true, status };
  }

  async settings() {
    const rows = await this.prisma.client.systemSetting.findMany({ orderBy: { key: "asc" } });
    return rows.map((row) => ({
      key: row.key,
      value: row.valueJson,
      description: row.description,
      isPublic: row.isPublic,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async updateSetting(actorId: string, key: string, value: unknown) {
    if (typeof key !== "string" || key.length > 120) {
      throw new BadRequestException("Invalid setting key");
    }
    const existing = await this.prisma.client.systemSetting.findUnique({ where: { key } });
    const row = await this.prisma.client.systemSetting.upsert({
      where: { key },
      create: { key, valueJson: value as Prisma.InputJsonValue, updatedById: actorId },
      update: { valueJson: value as Prisma.InputJsonValue, updatedById: actorId },
    });

    await this.audit(actorId, "setting.update", "SystemSetting", key, {
      from: existing?.valueJson ?? null,
      to: value,
    });

    return { key: row.key, value: row.valueJson, updatedAt: row.updatedAt.toISOString() };
  }

  async publicSettings() {
    const rows = await this.prisma.client.systemSetting.findMany({
      where: { isPublic: true },
      orderBy: { key: "asc" },
    });
    return Object.fromEntries(rows.map((row) => [row.key, row.valueJson]));
  }

  async integrations() {
    const rows = await this.prisma.client.integration.findMany({ orderBy: { name: "asc" } });
    // configJson is never returned; only a boolean indicating whether values exist.
    return rows.map((row) => ({
      key: row.key,
      name: row.name,
      category: row.category,
      status: row.status,
      hasConfiguration: Boolean(row.configJson),
      lastCheckedAt: row.lastCheckedAt?.toISOString() ?? null,
      lastError: row.lastError,
      updatedAt: row.updatedAt.toISOString(),
    }));
  }

  async auditLogs(page = 1, pageSize = 30) {
    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.auditLog.count(),
      this.prisma.client.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      items: rows.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        actorEmail: row.actorEmail,
        before: row.beforeJson,
        after: row.afterJson,
        createdAt: row.createdAt.toISOString(),
      })),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async health() {
    const dbOk = await this.prisma.ping();
    const integrations = await this.prisma.client.integration.findMany({
      select: { key: true, status: true },
    });
    const statusFor = (key: string) =>
      integrations.find((i) => i.key === key)?.status ?? "NOT_CONFIGURED";

    return {
      api: { status: "ok", uptimeSeconds: Math.round(process.uptime()) },
      database: { status: dbOk ? "connected" : "unreachable" },
      redis: { status: env.REDIS_URL ? "configured" : "not_configured" },
      email: {
        status: env.EMAIL_PROVIDER && statusFor("email") !== "NOT_CONFIGURED"
          ? "configured"
          : env.EMAIL_PROVIDER
            ? "configured"
            : "not_configured",
      },
      ai: { status: env.CHATBOT_ENABLED && env.AI_API_KEY ? "configured" : "disabled" },
      storage: { status: env.S3_BUCKET ? "configured" : "not_configured" },
      push: { status: statusFor("push.expo") },
      payments: {
        jazzcash: statusFor("payments.jazzcash"),
        easypaisa: statusFor("payments.easypaisa"),
        card: statusFor("payments.card"),
      },
      integrations,
      timestamp: new Date().toISOString(),
    };
  }

  async audit(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string | null,
    details?: { from?: unknown; to?: unknown },
  ) {
    const actor = await this.prisma.client.user.findUnique({
      where: { id: actorId },
      select: { email: true },
    });
    await this.prisma.client.auditLog.create({
      data: {
        actorId,
        actorEmail: actor?.email,
        action,
        entityType,
        entityId,
        beforeJson: (details?.from ?? undefined) as Prisma.InputJsonValue | undefined,
        afterJson: (details?.to ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
