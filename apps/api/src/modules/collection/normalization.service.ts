import { Injectable, Logger } from "@nestjs/common";
import { slugify } from "@paktenders/shared-utils";
import { PrismaService } from "../../common/prisma/prisma.service";
import type { RawTenderItem, SourceConfig, NormalizedTender } from "./collection.types";
import type { AiResult } from "./extraction/ai-classifier.service";
import {
  normalizeOrganization,
  normalizeReference,
  normalizeTitle,
  type ExtractedFields,
} from "./extraction/field-extractor";
import { oneLine, cleanText } from "./extraction/date-utils";

interface CategoryRow {
  id: string;
  slug: string;
  name: string;
}

interface ProvinceRow {
  id: string;
  slug: string;
  name: string;
  code: string;
}

interface CityRow {
  id: string;
  slug: string;
  name: string;
  provinceId: string;
  provinceSlug: string;
}

interface ReferenceData {
  loadedAt: number;
  categories: CategoryRow[];
  provinces: ProvinceRow[];
  cities: CityRow[];
}

const REFERENCE_TTL_MS = 5 * 60_000;
const FALLBACK_CATEGORY = "other-services-supplies";
const FALLBACK_PROVINCE = "islamabad";

function matchByText<T extends { slug: string; name: string }>(rows: T[], value: string | undefined): T | null {
  if (!value) return null;
  const needle = oneLine(value).toLowerCase();
  if (!needle) return null;
  const exactSlug = rows.find((row) => row.slug === needle);
  if (exactSlug) return exactSlug;
  const exactName = rows.find((row) => row.name.toLowerCase() === needle);
  if (exactName) return exactName;
  if (needle.length < 4) return null;
  const partial = rows
    .filter((row) => needle.includes(row.name.toLowerCase()) || row.name.toLowerCase().includes(needle))
    .sort((a, b) => b.name.length - a.name.length);
  return partial[0] ?? null;
}

function mapTenderType(value: string | undefined, sourceCategory: string): NormalizedTender["tenderType"] | null {
  if (!value) return null;
  const text = value.toLowerCase();
  if (/\bauction|disposal|scrap|e-auction\b/.test(text)) return "AUCTION";
  if (/\bconsultancy|consultant|request for proposal|rfp|expression of interest|eoi\b/.test(text)) return "CONSULTANCY";
  if (/\bngo|donor|grant\b/.test(text)) return "NGO";
  if (/\bprivate|pvt\.? ltd\b/.test(text)) return "PRIVATE";
  if (sourceCategory === "NEWSPAPER") return "NEWSPAPER";
  if (/\bgovernment|public|goods|works|services\b/.test(text)) return "GOVERNMENT";
  return null;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

@Injectable()
export class NormalizationService {
  private readonly logger = new Logger(NormalizationService.name);
  private reference: ReferenceData | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Location lists used by deterministic field extraction. */
  async locationContext(source: SourceConfig) {
    const data = await this.referenceData();
    return {
      sourceName: source.name,
      sourceCategory: source.category,
      defaultProvinceSlug: data.provinces.find((row) => row.id === source.provinceId)?.slug ?? null,
      cities: data.cities.map((row) => ({ name: row.name, slug: row.slug, provinceSlug: row.provinceSlug })),
      provinces: data.provinces.map((row) => ({ name: row.name, slug: row.slug })),
    };
  }

  /** Reference lists passed to the optional AI classifier. */
  async aiContext() {
    const data = await this.referenceData();
    return {
      categories: data.categories.map((row) => ({ slug: row.slug, name: row.name })),
      provinces: data.provinces.map((row) => ({ slug: row.slug, name: row.name })),
      cities: data.cities.map((row) => ({ slug: row.slug, name: row.name, provinceSlug: row.provinceSlug })),
    };
  }

  private async referenceData(): Promise<ReferenceData> {
    if (this.reference && Date.now() - this.reference.loadedAt < REFERENCE_TTL_MS) return this.reference;
    const [categories, provinces, cities] = await Promise.all([
      this.prisma.client.category.findMany({
        where: { isActive: true },
        select: { id: true, slug: true, name: true },
      }),
      this.prisma.client.province.findMany({ select: { id: true, slug: true, name: true, code: true } }),
      this.prisma.client.city.findMany({
        select: { id: true, slug: true, name: true, provinceId: true, province: { select: { slug: true } } },
      }),
    ]);
    this.reference = {
      loadedAt: Date.now(),
      categories,
      provinces,
      cities: cities.map((city) => ({
        id: city.id,
        slug: city.slug,
        name: city.name,
        provinceId: city.provinceId,
        provinceSlug: city.province.slug,
      })),
    };
    return this.reference;
  }

  private async resolveDepartment(
    name: string,
    source: SourceConfig,
    provinceId: string,
    cityId: string | null,
  ): Promise<{ id: string; created: boolean }> {
    const trimmed = oneLine(name).slice(0, 180) || source.name;
    const existing = await this.prisma.client.department.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
      select: { id: true },
    });
    if (existing) return { id: existing.id, created: false };

    const base = slugify(trimmed).slice(0, 60) || `department-${Date.now()}`;
    let slug = base;
    let attempt = 0;
    for (;;) {
      const clash = await this.prisma.client.department.findUnique({ where: { slug }, select: { id: true } });
      if (!clash) break;
      attempt += 1;
      slug = `${base}-${attempt + 1}`.slice(0, 70);
      if (attempt > 20) {
        slug = `${base}-${Date.now().toString(36)}`;
        break;
      }
    }

    const type =
      source.category === "FEDERAL"
        ? "FEDERAL"
        : source.category === "PROVINCIAL"
          ? "PROVINCIAL"
          : source.category === "PUBLIC_SECTOR"
            ? "PUBLIC_SECTOR"
            : source.category === "PRIVATE"
              ? "PRIVATE"
              : "OTHER";

    try {
      const created = await this.prisma.client.department.create({
        data: { name: trimmed, slug, type, provinceId, cityId },
        select: { id: true },
      });
      return { id: created.id, created: true };
    } catch {
      const raced = await this.prisma.client.department.findUnique({ where: { slug }, select: { id: true } });
      if (raced) return { id: raced.id, created: false };
      throw new Error(`Could not resolve or create the department "${trimmed}".`);
    }
  }

  /**
   * Converts a connector item plus document/AI extraction into database-ready
   * values. Source values always win over derived values; AI values are only
   * used for fields the source did not publish, and are labelled as AI.
   */
  async normalize(input: {
    source: SourceConfig;
    item: RawTenderItem;
    extracted: ExtractedFields;
    ai: AiResult | null;
    documentText: string;
    documentHashes: string[];
    documentIds: string[];
  }): Promise<NormalizedTender> {
    const { source, item, extracted, ai, documentText } = input;
    const data = await this.referenceData();
    const warnings: string[] = [...extracted.warnings];
    const fieldSources: NormalizedTender["fieldSources"] = {};
    const fieldConfidence: Record<string, number> = {};

    const title = oneLine(item.title).slice(0, 300);
    fieldSources.title = "SOURCE";
    fieldConfidence.title = item.fieldConfidence?.title ?? 0.9;

    const cityText = item.city ?? extracted.citySlug ?? undefined;
    const provinceText = item.province ?? extracted.provinceSlug ?? undefined;

    let city: CityRow | null = null;
    let province: ProvinceRow | null = null;

    if (cityText) {
      const needle = oneLine(cityText).toLowerCase();
      city =
        data.cities.find((row) => row.slug === needle) ??
        data.cities.find((row) => row.name.toLowerCase() === needle) ??
        null;
      if (city) {
        province = data.provinces.find((row) => row.id === city?.provinceId) ?? null;
      }
    }

    if (!province && provinceText) {
      province = matchByText(data.provinces, provinceText);
      fieldSources.provinceSlug = item.province ? "SOURCE" : "RULE";
      fieldConfidence.provinceSlug = item.province
        ? (item.fieldConfidence?.provinceSlug ?? 0.85)
        : (extracted.confidence.provinceSlug ?? 0.6);
    }
    if (!province && source.provinceId) {
      province = data.provinces.find((row) => row.id === source.provinceId) ?? null;
      if (province) {
        fieldSources.provinceSlug = "RULE";
        fieldConfidence.provinceSlug = 0.55;
        warnings.push("Province was not published; the source's configured province was used.");
      }
    }
    if (!province) {
      province = data.provinces.find((row) => row.slug === FALLBACK_PROVINCE) ?? data.provinces[0] ?? null;
      if (province) {
        fieldSources.provinceSlug = "RULE";
        fieldConfidence.provinceSlug = 0.4;
        warnings.push("Province could not be determined; Islamabad was used as a placeholder.");
      }
    }
    if (!province) throw new Error("No provinces exist in the database; seed the reference data first.");

    if (city && city.provinceId !== province.id) city = null;
    if (city) {
      fieldSources.citySlug = item.city ? "SOURCE" : "RULE";
      fieldConfidence.citySlug = item.city ? (item.fieldConfidence?.citySlug ?? 0.8) : (extracted.confidence.citySlug ?? 0.6);
    }

    const categoryCandidate = matchByText(data.categories, item.category);
    let category: CategoryRow | null = categoryCandidate;
    if (category) {
      fieldSources.categorySlug = "SOURCE";
      fieldConfidence.categorySlug = item.fieldConfidence?.category ?? 0.7;
    }
    if (!category && ai?.categorySlug) {
      category = data.categories.find((row) => row.slug === ai.categorySlug) ?? null;
      if (category) {
        fieldSources.categorySlug = "AI";
        fieldConfidence.categorySlug = ai.confidence ?? 0.7;
      }
    }
    if (!category && extracted.categorySlug) {
      category = data.categories.find((row) => row.slug === extracted.categorySlug) ?? null;
      if (category) {
        fieldSources.categorySlug = "RULE";
        fieldConfidence.categorySlug = extracted.confidence.categorySlug ?? 0.6;
      }
    }
    if (!category) {
      category = data.categories.find((row) => row.slug === FALLBACK_CATEGORY) ?? data.categories[0] ?? null;
      if (category) {
        fieldSources.categorySlug = "RULE";
        fieldConfidence.categorySlug = 0.35;
        warnings.push("Category could not be determined; the notice is filed under Other Services and Supplies.");
      }
    }
    if (!category) throw new Error("No categories exist in the database; seed the reference data first.");

    const organizationName =
      oneLine(item.organization ?? item.department ?? extracted.organization ?? "") ||
      source.name;
    if (item.organization || item.department) {
      fieldSources.organization = "SOURCE";
      fieldConfidence.organization = item.fieldConfidence?.organization ?? 0.85;
    } else if (extracted.organization) {
      fieldSources.organization = "RULE";
      fieldConfidence.organization = extracted.confidence.organization ?? 0.7;
    } else {
      fieldSources.organization = "RULE";
      fieldConfidence.organization = 0.4;
      warnings.push("Organization was not published; the source name was recorded as the issuing body.");
    }
    const department = await this.resolveDepartment(
      organizationName,
      source,
      province.id,
      city?.id ?? null,
    );
    if (department.created) {
      warnings.push(`A new department record was created for "${organizationName}".`);
    }

    const referenceNumber = oneLine(item.referenceNumber ?? extracted.referenceNumber ?? "") || null;
    if (referenceNumber) {
      fieldSources.referenceNumber = item.referenceNumber ? "SOURCE" : "RULE";
      fieldConfidence.referenceNumber = item.referenceNumber
        ? (item.fieldConfidence?.referenceNumber ?? 0.85)
        : (extracted.confidence.referenceNumber ?? 0.7);
    }

    const publishedAt = item.publishedAt
      ? new Date(item.publishedAt)
      : (extracted.publishedAt ?? null);
    if (publishedAt && !Number.isNaN(publishedAt.getTime())) {
      fieldSources.publishedAt = item.publishedAt ? "SOURCE" : "RULE";
      fieldConfidence.publishedAt = item.publishedAt
        ? (item.fieldConfidence?.publishedAt ?? 0.9)
        : (extracted.confidence.publishedAt ?? 0.7);
    }

    const closingAt = item.closingAt ? new Date(item.closingAt) : (extracted.closingAt ?? null);
    if (closingAt && !Number.isNaN(closingAt.getTime())) {
      fieldSources.closingAt = item.closingAt ? "SOURCE" : "RULE";
      fieldConfidence.closingAt = item.closingAt
        ? (item.fieldConfidence?.closingAt ?? 0.9)
        : (extracted.confidence.closingAt ?? 0.7);
    }

    const openingAt = item.openingAt ? new Date(item.openingAt) : (extracted.openingAt ?? null);
    if (openingAt && !Number.isNaN(openingAt.getTime())) {
      fieldSources.openingAt = item.openingAt ? "SOURCE" : "RULE";
      fieldConfidence.openingAt = item.openingAt
        ? (item.fieldConfidence?.openingAt ?? 0.85)
        : (extracted.confidence.openingAt ?? 0.7);
    }

    const estimatedValue = item.estimatedValue ?? extracted.estimatedValue ?? null;
    if (estimatedValue) {
      fieldSources.estimatedValue = item.estimatedValue ? "SOURCE" : "RULE";
      fieldConfidence.estimatedValue = item.estimatedValue
        ? (item.fieldConfidence?.estimatedValue ?? 0.85)
        : (extracted.confidence.estimatedValue ?? 0.7);
    }

    const bidSecurityAmount = item.bidSecurity ?? extracted.bidSecurityAmount ?? null;
    if (bidSecurityAmount) {
      fieldSources.bidSecurityAmount = item.bidSecurity ? "SOURCE" : "RULE";
      fieldConfidence.bidSecurityAmount = item.bidSecurity
        ? (item.fieldConfidence?.bidSecurityAmount ?? 0.85)
        : (extracted.confidence.bidSecurityAmount ?? 0.7);
    }

    const eligibility =
      oneLine(item.eligibility ?? extracted.eligibility ?? ai?.eligibility ?? "") || null;
    if (eligibility) {
      fieldSources.eligibility = item.eligibility ? "SOURCE" : extracted.eligibility ? "RULE" : "AI";
      fieldConfidence.eligibility = item.eligibility
        ? 0.85
        : extracted.eligibility
          ? (extracted.confidence.eligibility ?? 0.7)
          : (ai?.confidence ?? 0.6);
    }

    const contactName = item.contactName ?? extracted.contactName ?? null;
    const contactEmail = item.contactEmail ?? extracted.contactEmail ?? null;
    const contactPhone = item.contactPhone ?? extracted.contactPhone ?? null;
    const contactAddress = item.contactAddress ?? extracted.contactAddress ?? null;
    if (contactEmail) {
      fieldSources.contactEmail = item.contactEmail ? "SOURCE" : "RULE";
      fieldConfidence.contactEmail = item.contactEmail ? 0.9 : 0.75;
    }
    if (contactPhone) {
      fieldSources.contactPhone = item.contactPhone ? "SOURCE" : "RULE";
      fieldConfidence.contactPhone = item.contactPhone ? 0.9 : 0.7;
    }

    const tenderType =
      mapTenderType(item.tenderType, source.category) ??
      extracted.tenderType ??
      (source.category === "NEWSPAPER" ? "NEWSPAPER" : "GOVERNMENT");
    fieldSources.tenderType = item.tenderType ? "SOURCE" : "RULE";
    fieldConfidence.tenderType = item.tenderType ? 0.8 : (extracted.confidence.tenderType ?? 0.55);

    const descriptionSource = cleanText(item.description ?? "");
    const description =
      descriptionSource.length >= 20
        ? descriptionSource.slice(0, 8000)
        : cleanText(documentText).slice(0, 8000) || descriptionSource || title;
    if (description === title) {
      warnings.push("No description was published; the title is used as the description until a document is reviewed.");
    }

    const summary = ai?.summary ?? null;
    if (summary) fieldSources.summary = "AI";

    const confidenceValues = [
      fieldConfidence.title,
      fieldConfidence.referenceNumber,
      fieldConfidence.organization,
      fieldConfidence.categorySlug,
      fieldConfidence.provinceSlug,
      fieldConfidence.closingAt,
      fieldConfidence.publishedAt,
    ].filter((value): value is number => typeof value === "number");
    let confidence = average(confidenceValues) ?? 0.4;
    if (!closingAt) confidence = Math.min(confidence, 0.65);
    if (!referenceNumber) confidence = Math.min(confidence, 0.8);
    if (warnings.some((warning) => /OCR failed|Scanned|scanned/i.test(warning))) {
      confidence = Math.min(confidence, 0.55);
    }
    confidence = Math.round(confidence * 100) / 100;

    const normalizedTitle = normalizeTitle(title);
    const normalizedReference = normalizeReference(referenceNumber);
    const normalizedOrganization = normalizeOrganization(organizationName);

    return {
      title,
      referenceNumber,
      description,
      summary,
      organizationName,
      departmentId: department.id,
      categoryId: category.id,
      provinceId: province.id,
      cityId: city?.id ?? null,
      tenderType,
      publishedAt: publishedAt && !Number.isNaN(publishedAt.getTime()) ? publishedAt : null,
      closingAt: closingAt && !Number.isNaN(closingAt.getTime()) ? closingAt : null,
      openingAt: openingAt && !Number.isNaN(openingAt.getTime()) ? openingAt : null,
      estimatedValue,
      bidSecurityAmount,
      bidSecurityDetails: null,
      eligibility,
      requiredDocuments: item.requiredDocuments ?? extracted.requiredDocuments ?? [],
      contactName,
      contactEmail,
      contactPhone,
      contactAddress,
      originalUrl: item.sourceUrl,
      originalDocumentUrl: item.documentUrls?.[0] ?? null,
      confidence,
      fieldSources,
      fieldConfidence,
      warnings: Array.from(new Set(warnings)),
      signals: {
        normalizedTitle,
        normalizedReference,
        normalizedOrganization,
        documentHashes: input.documentHashes.filter(Boolean),
      },
    };
  }
}
