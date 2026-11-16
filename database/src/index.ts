import { PrismaClient } from "@prisma/client";

/**
 * Shared PrismaClient singleton.
 *
 * Next.js dev mode hot-reloads modules, which would otherwise open a new
 * connection pool on every reload. The global cache prevents connection
 * exhaustion. The API process uses the same singleton.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
export { Prisma } from "@prisma/client";
