import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import type { Paginated, TenderSummary } from "@paktenders/shared-types";
import type { UpdateProfileInput } from "@paktenders/validation";
import { PrismaService } from "../../common/prisma/prisma.service";
import { tenderSummaryInclude, toTenderSummary } from "../tenders/tender.serializer";

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async profile(userId: string) {
    const user = await this.prisma.client.user.findUniqueOrThrow({
      where: { id: userId },
      include: {
        profile: { include: { province: true, city: true } },
        preference: true,
        notificationPref: true,
        roles: { include: { role: true } },
        subscriptions: {
          where: { status: { in: ["ACTIVE", "TRIAL"] } },
          include: { plan: true },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      createdAt: user.createdAt.toISOString(),
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      roles: user.roles.map((r) => r.role.code),
      profile: user.profile
        ? {
            avatarUrl: user.profile.avatarUrl,
            jobTitle: user.profile.jobTitle,
            bio: user.profile.bio,
            provinceId: user.profile.provinceId,
            cityId: user.profile.cityId,
            provinceName: user.profile.province?.name ?? null,
            cityName: user.profile.city?.name ?? null,
            preferredKeywords: user.profile.preferredKeywords,
            businessCategories: user.profile.businessCategories,
            marketingOptIn: user.profile.marketingOptIn,
          }
        : null,
      preference: user.preference,
      notificationPreferences: user.notificationPref,
      subscription: user.subscriptions[0]
        ? {
            id: user.subscriptions[0].id,
            planCode: user.subscriptions[0].plan.code,
            planName: user.subscriptions[0].plan.name,
            status: user.subscriptions[0].status,
            endsAt: user.subscriptions[0].endsAt?.toISOString() ?? null,
          }
        : null,
    };
  }

  async updateProfile(userId: string, input: UpdateProfileInput) {
    await this.prisma.client.user.update({
      where: { id: userId },
      data: {
        ...(input.fullName !== undefined ? { fullName: input.fullName } : {}),
        ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
        profile: {
          upsert: {
            create: {
              jobTitle: input.jobTitle ?? null,
              bio: input.bio ?? null,
              provinceId: input.provinceId ?? null,
              cityId: input.cityId ?? null,
              preferredKeywords: input.preferredKeywords ?? [],
              marketingOptIn: input.marketingOptIn ?? false,
            },
            update: {
              ...(input.jobTitle !== undefined ? { jobTitle: input.jobTitle } : {}),
              ...(input.bio !== undefined ? { bio: input.bio } : {}),
              ...(input.provinceId !== undefined ? { provinceId: input.provinceId } : {}),
              ...(input.cityId !== undefined ? { cityId: input.cityId } : {}),
              ...(input.preferredKeywords !== undefined
                ? { preferredKeywords: input.preferredKeywords }
                : {}),
              ...(input.marketingOptIn !== undefined
                ? { marketingOptIn: input.marketingOptIn }
                : {}),
            },
          },
        },
      },
    });
    return this.profile(userId);
  }

  async updatePreferences(
    userId: string,
    input: {
      theme?: string;
      language?: string;
      pushEnabled?: boolean;
      emailEnabled?: boolean;
      digestFrequency?: "INSTANT" | "DAILY" | "WEEKLY";
      whatsappEnabled?: boolean;
      smsEnabled?: boolean;
      quietHoursStart?: number | null;
      quietHoursEnd?: number | null;
    },
  ) {
    await this.prisma.client.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        theme: input.theme ?? "system",
        language: input.language ?? "en",
        pushEnabled: input.pushEnabled ?? true,
        emailEnabled: input.emailEnabled ?? true,
      },
      update: {
        ...(input.theme !== undefined ? { theme: input.theme } : {}),
        ...(input.language !== undefined ? { language: input.language } : {}),
        ...(input.pushEnabled !== undefined ? { pushEnabled: input.pushEnabled } : {}),
        ...(input.emailEnabled !== undefined ? { emailEnabled: input.emailEnabled } : {}),
      },
    });

    await this.prisma.client.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        digestFrequency: input.digestFrequency ?? "DAILY",
        whatsappEnabled: input.whatsappEnabled ?? false,
        smsEnabled: input.smsEnabled ?? false,
        quietHoursStart: input.quietHoursStart ?? null,
        quietHoursEnd: input.quietHoursEnd ?? null,
      },
      update: {
        ...(input.digestFrequency !== undefined ? { digestFrequency: input.digestFrequency } : {}),
        ...(input.whatsappEnabled !== undefined ? { whatsappEnabled: input.whatsappEnabled } : {}),
        ...(input.smsEnabled !== undefined ? { smsEnabled: input.smsEnabled } : {}),
        ...(input.quietHoursStart !== undefined ? { quietHoursStart: input.quietHoursStart } : {}),
        ...(input.quietHoursEnd !== undefined ? { quietHoursEnd: input.quietHoursEnd } : {}),
      },
    });

    return this.profile(userId);
  }

  async savedTenders(userId: string, page = 1, pageSize = 20): Promise<Paginated<TenderSummary>> {
    const [total, rows] = await this.prisma.client.$transaction([
      this.prisma.client.savedTender.count({ where: { userId } }),
      this.prisma.client.savedTender.findMany({
        where: { userId },
        include: { tender: { include: tenderSummaryInclude } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((r) => toTenderSummary(r.tender)),
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async saveTender(userId: string, tenderId: string) {
    const tender = await this.prisma.client.tender.findFirst({
      where: { id: tenderId, deletedAt: null, status: { in: ["PUBLISHED", "CLOSED"] } },
      select: { id: true },
    });
    if (!tender) throw new NotFoundException("Tender not found");

    await this.prisma.client.savedTender.upsert({
      where: { userId_tenderId: { userId, tenderId } },
      create: { userId, tenderId },
      update: {},
    });
    return { saved: true };
  }

  async unsaveTender(userId: string, tenderId: string) {
    await this.prisma.client.savedTender.deleteMany({ where: { userId, tenderId } });
    return { saved: false };
  }

  async savedSearches(userId: string) {
    return this.prisma.client.savedSearch.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  async createSavedSearch(userId: string, name: string, queryJson: Record<string, unknown>) {
    return this.prisma.client.savedSearch.create({
      data: { userId, name, queryJson: queryJson as object },
    });
  }

  async deleteSavedSearch(userId: string, id: string) {
    await this.prisma.client.savedSearch.deleteMany({ where: { id, userId } });
    return { success: true };
  }

  async alerts(userId: string) {
    return this.prisma.client.alertRule.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { category: { select: { id: true, name: true, slug: true } } },
    });
  }

  async createAlert(
    userId: string,
    input: {
      name: string;
      queryJson: Record<string, unknown>;
      categoryId?: string | null;
      frequency: "INSTANT" | "DAILY" | "WEEKLY";
      channels: Array<"IN_APP" | "EMAIL" | "PUSH" | "WHATSAPP" | "SMS">;
      isActive: boolean;
    },
  ) {
    return this.prisma.client.alertRule.create({
      data: {
        userId,
        name: input.name,
        queryJson: input.queryJson as object,
        categoryId: input.categoryId ?? null,
        frequency: input.frequency,
        channels: input.channels,
        isActive: input.isActive,
      },
    });
  }

  async deleteAlert(userId: string, id: string) {
    await this.prisma.client.alertRule.deleteMany({ where: { id, userId } });
    return { success: true };
  }

  async toggleAlert(userId: string, id: string, isActive: boolean) {
    const updated = await this.prisma.client.alertRule.updateMany({
      where: { id, userId },
      data: { isActive },
    });
    if (updated.count === 0) throw new NotFoundException("Alert not found");
    return { success: true, isActive };
  }

  async notifications(userId: string, page = 1, pageSize = 30) {
    const [total, unread, rows] = await this.prisma.client.$transaction([
      this.prisma.client.notification.count({ where: { userId } }),
      this.prisma.client.notification.count({ where: { userId, isRead: false } }),
      this.prisma.client.notification.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return {
      items: rows.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        type: n.type,
        data: n.dataJson,
        isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
      unread,
      meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
    };
  }

  async markNotificationsRead(userId: string, ids?: string[]) {
    await this.prisma.client.notification.updateMany({
      where: { userId, ...(ids?.length ? { id: { in: ids } } : {}) },
      data: { isRead: true, readAt: new Date() },
    });
    return { success: true };
  }

  async subscription(userId: string) {
    const sub = await this.prisma.client.subscription.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { plan: true },
    });
    if (!sub) return null;
    return {
      id: sub.id,
      status: sub.status,
      startsAt: sub.startsAt?.toISOString() ?? null,
      endsAt: sub.endsAt?.toISOString() ?? null,
      autoRenew: sub.autoRenew,
      plan: {
        code: sub.plan.code,
        name: sub.plan.name,
        pricePkr: sub.plan.pricePkr.toString(),
        interval: sub.plan.interval,
        features: sub.plan.features,
      },
    };
  }

  async invoices(userId: string) {
    const rows = await this.prisma.client.invoice.findMany({
      where: { userId },
      orderBy: { issuedAt: "desc" },
      take: 50,
    });
    return rows.map((i) => ({
      id: i.id,
      number: i.number,
      total: i.total.toString(),
      issuedAt: i.issuedAt.toISOString(),
      pdfUrl: i.pdfUrl,
    }));
  }

  /**
   * Account deletion: revokes sessions, anonymises direct identifiers and marks
   * the account deleted. Retained records (invoices, audit logs) keep the
   * account id for legal and accounting requirements.
   */
  async deleteAccount(userId: string, confirmation: string) {
    if (confirmation !== "DELETE") {
      throw new BadRequestException('Type "DELETE" to confirm account deletion');
    }
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("Account not found");

    await this.prisma.client.$transaction([
      this.prisma.client.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.client.pushToken.updateMany({ where: { userId }, data: { isActive: false } }),
      this.prisma.client.savedTender.deleteMany({ where: { userId } }),
      this.prisma.client.alertRule.updateMany({ where: { userId }, data: { isActive: false } }),
      this.prisma.client.user.update({
        where: { id: userId },
        data: {
          status: "DELETED",
          deletedAt: new Date(),
          email: `deleted+${userId}@paktenders.invalid`,
          fullName: "Deleted account",
          phone: null,
          passwordHash: "deleted",
        },
      }),
    ]);

    return { success: true };
  }
}
