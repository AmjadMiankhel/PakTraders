import { z } from "zod";

/**
 * Server-side environment schema. Parsed once at API boot so that a missing or
 * malformed variable fails fast with a readable error instead of a runtime
 * crash deep inside a request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  API_PUBLIC_URL: z.string().default("http://localhost:4000"),
  CORS_ORIGINS: z.string().default("http://localhost:3000"),
  // Number of reverse-proxy hops in front of the API. Hostinger puts a CDN and
  // LiteSpeed in front of Node, so production usually needs 2.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(1),

  JWT_ACCESS_SECRET: z.string().min(32, "JWT_ACCESS_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),

  REDIS_URL: z.string().optional().default(""),
  BULLMQ_PREFIX: z.string().default("paktenders"),

  COLLECTION_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  COLLECTION_WORKER_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  COLLECTION_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  COLLECTION_USER_AGENT: z
    .string()
    .default("PakTendersBot/1.0 (+https://paktenders.pk/bot)"),
  COLLECTION_HTTP_TIMEOUT_MS: z.coerce.number().int().min(5000).max(120000).default(30000),
  COLLECTION_MAX_DOCUMENT_MB: z.coerce.number().int().min(1).max(100).default(25),
  COLLECTION_MAX_ITEMS_PER_RUN: z.coerce.number().int().min(1).max(500).default(100),
  COLLECTION_DEADLINE_CRON: z.string().default("0 2 * * *"),
  COLLECTION_RECONCILE_CRON: z.string().default("30 2 * * *"),
  OCR_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  OCR_LANGUAGES: z.string().default("eng,urd"),
  AI_COLLECTION_ENABLED: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
  COLLECTION_EMAIL_HOST: z.string().optional().default(""),
  COLLECTION_EMAIL_USER: z.string().optional().default(""),
  COLLECTION_EMAIL_PASSWORD: z.string().optional().default(""),

  EMAIL_PROVIDER: z.string().optional().default(""),
  EMAIL_FROM: z.string().default("no-reply@paktenders.pk"),
  RESEND_API_KEY: z.string().optional().default(""),

  S3_ENDPOINT: z.string().optional().default(""),
  S3_BUCKET: z.string().optional().default(""),

  AI_PROVIDER: z.string().optional().default(""),
  AI_MODEL: z.string().optional().default(""),
  AI_API_KEY: z.string().optional().default(""),
  AI_BASE_URL: z.string().optional().default(""),
  CHATBOT_ENABLED: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),

  NEXT_PUBLIC_SITE_URL: z.string().default("http://localhost:3000"),
  SITE_URL: z.string().default("http://localhost:3000"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export function corsOrigins(env: Env): string[] {
  return env.CORS_ORIGINS.split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export const isProduction = (env: Env): boolean => env.NODE_ENV === "production";
