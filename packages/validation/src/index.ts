import { z } from "zod";

/* ---------------------------------- auth --------------------------------- */

export const passwordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must include a lowercase letter")
  .regex(/[A-Z]/, "Password must include an uppercase letter")
  .regex(/[0-9]/, "Password must include a number");

export const registerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  email: z.email("Enter a valid email address").max(254).toLowerCase(),
  password: passwordSchema,
  phone: z
    .string()
    .trim()
    .regex(/^(\+92|0)?3\d{9}$/, "Enter a valid Pakistani mobile number")
    .optional()
    .or(z.literal("")),
  acceptTerms: z.literal(true, { message: "You must accept the terms" }),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.email("Enter a valid email address").toLowerCase(),
  password: z.string().min(1, "Enter your password"),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: z.email().toLowerCase(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^(\+92|0)?3\d{9}$/)
    .optional()
    .or(z.literal("")),
  jobTitle: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(1000).optional(),
  cityId: z.uuid().optional().nullable(),
  provinceId: z.uuid().optional().nullable(),
  preferredKeywords: z.array(z.string().trim().min(2).max(60)).max(20).optional(),
  marketingOptIn: z.boolean().optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/* -------------------------------- tenders -------------------------------- */

export const tenderTypeSchema = z.enum([
  "GOVERNMENT",
  "PRIVATE",
  "NGO",
  "AUCTION",
  "CONSULTANCY",
  "NEWSPAPER",
]);

export const tenderStatusSchema = z.enum([
  "DRAFT",
  "PENDING_VERIFICATION",
  "PUBLISHED",
  "CLOSED",
  "CANCELLED",
  "ARCHIVED",
]);

export const tenderSearchSchema = z.object({
  q: z.string().trim().max(160).optional(),
  category: z.string().trim().max(120).optional(),
  province: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  department: z.string().trim().max(160).optional(),
  type: tenderTypeSchema.optional(),
  status: tenderStatusSchema.optional(),
  closingWithinDays: z.coerce.number().int().min(0).max(365).optional(),
  publishedFrom: z.string().optional(),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(["newest", "closing", "relevance"]).default("newest"),
});
export type TenderSearchInput = z.infer<typeof tenderSearchSchema>;

const optionalUrl = z
  .string()
  .trim()
  .max(2048)
  .refine((v) => v === "" || /^https?:\/\//i.test(v), "Must be an http(s) URL")
  .optional()
  .or(z.literal(""));

export const createTenderSchema = z.object({
  title: z.string().trim().min(8, "Title is too short").max(240),
  slug: z.string().trim().min(3).max(120).optional(),
  referenceNumber: z.string().trim().max(120).optional(),
  description: z.string().trim().min(30, "Provide at least 30 characters").max(20_000),
  summary: z.string().trim().max(400).optional(),
  categoryId: z.uuid(),
  departmentId: z.uuid(),
  provinceId: z.uuid(),
  cityId: z.uuid().optional().nullable(),
  sourceId: z.uuid().optional().nullable(),
  tenderType: tenderTypeSchema.default("GOVERNMENT"),
  status: tenderStatusSchema.default("DRAFT"),
  verificationStatus: z.enum(["UNVERIFIED", "PENDING", "VERIFIED"]).default("UNVERIFIED"),
  publishedAt: z.coerce.date().optional().nullable(),
  closingAt: z.coerce.date().optional().nullable(),
  openingAt: z.coerce.date().optional().nullable(),
  estimatedValue: z.coerce.number().nonnegative().max(1_000_000_000_000).optional().nullable(),
  eligibility: z.string().trim().max(10_000).optional(),
  bidSecurityAmount: z.coerce.number().nonnegative().max(1_000_000_000_000).optional().nullable(),
  bidSecurityDetails: z.string().trim().max(2000).optional(),
  requiredDocuments: z.array(z.string().trim().min(2).max(200)).max(50).default([]),
  contactName: z.string().trim().max(120).optional(),
  contactEmail: z.union([z.email(), z.literal("")]).optional(),
  contactPhone: z.string().trim().max(40).optional(),
  contactAddress: z.string().trim().max(400).optional(),
  originalUrl: optionalUrl,
  sourceAttribution: z.string().trim().max(400).optional(),
  isFeatured: z.boolean().default(false),
});
export type CreateTenderInput = z.infer<typeof createTenderSchema>;

export const updateTenderSchema = createTenderSchema.partial();
export type UpdateTenderInput = z.infer<typeof updateTenderSchema>;

/* ------------------------------ engagement ------------------------------- */

export const saveSearchSchema = z.object({
  name: z.string().trim().min(2).max(80),
  queryJson: z.record(z.string(), z.unknown()),
});

export const alertRuleSchema = z.object({
  name: z.string().trim().min(2).max(80),
  queryJson: z.record(z.string(), z.unknown()),
  categoryId: z.uuid().optional().nullable(),
  frequency: z.enum(["INSTANT", "DAILY", "WEEKLY"]).default("DAILY"),
  channels: z.array(z.enum(["IN_APP", "EMAIL", "PUSH", "WHATSAPP", "SMS"])).min(1).default(["IN_APP"]),
  isActive: z.boolean().default(true),
});

export const supportTicketSchema = z.object({
  subject: z.string().trim().min(4).max(160),
  message: z.string().trim().min(20).max(5000),
});

/* ------------------------------ pagination ------------------------------- */

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export function firstZodError(error: z.ZodError): string {
  const issue = error.issues[0];
  return issue ? `${issue.path.join(".") || "input"}: ${issue.message}` : "Invalid input";
}
