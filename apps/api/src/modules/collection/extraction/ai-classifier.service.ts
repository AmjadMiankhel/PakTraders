import { Injectable, Logger } from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import { z } from "zod";
import { oneLine } from "../extraction/date-utils";

const env = loadEnv();

const aiResultSchema = z.object({
  categorySlug: z.string().nullable().optional(),
  provinceSlug: z.string().nullable().optional(),
  citySlug: z.string().nullable().optional(),
  tenderType: z.enum(["GOVERNMENT", "PRIVATE", "NGO", "AUCTION", "CONSULTANCY", "NEWSPAPER"]).nullable().optional(),
  summary: z.string().max(600).nullable().optional(),
  eligibility: z.string().max(1200).nullable().optional(),
  isCorrigendum: z.boolean().nullable().optional(),
  confidence: z.number().min(0).max(1).nullable().optional(),
});

export type AiResult = z.infer<typeof aiResultSchema>;

export interface AiEnrichmentInput {
  title: string;
  organization: string | null;
  text: string;
  sourceName: string;
  categories: Array<{ slug: string; name: string }>;
  provinces: Array<{ slug: string; name: string }>;
  cities: Array<{ slug: string; name: string; provinceSlug: string }>;
}

function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text)?.[1];
  const candidate = (fenced ?? text).trim();
  try {
    return JSON.parse(candidate);
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(candidate.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

@Injectable()
export class AiClassifierService {
  private readonly logger = new Logger(AiClassifierService.name);

  get enabled(): boolean {
    return Boolean(env.AI_COLLECTION_ENABLED && env.AI_API_KEY && env.AI_PROVIDER);
  }

  get status(): { enabled: boolean; provider: string | null; reason: string | null } {
    if (!env.AI_COLLECTION_ENABLED) return { enabled: false, provider: null, reason: "AI_COLLECTION_ENABLED is false" };
    if (!env.AI_API_KEY) return { enabled: false, provider: env.AI_PROVIDER || null, reason: "AI_API_KEY is not configured" };
    if (!env.AI_PROVIDER) return { enabled: false, provider: null, reason: "AI_PROVIDER is not configured" };
    return { enabled: true, provider: env.AI_PROVIDER, reason: null };
  }

  private buildPrompt(input: AiEnrichmentInput): string {
    const categoryList = input.categories.map((entry) => `${entry.slug} (${entry.name})`).join("; ");
    const provinceList = input.provinces.map((entry) => `${entry.slug} (${entry.name})`).join("; ");
    const cityList = input.cities.slice(0, 200).map((entry) => `${entry.slug}/${entry.provinceSlug}`).join(", ");
    return [
      "You classify Pakistani public procurement notices. Return JSON only.",
      "Use ONLY information present in the notice text. Never invent values; return null when the text does not support a value.",
      "Choose categorySlug from this exact list: " + categoryList + ".",
      "Choose provinceSlug from this exact list: " + provinceList + ".",
      "citySlug must be one of these slug/province pairs, or null: " + cityList + ".",
      "tenderType must be GOVERNMENT, PRIVATE, NGO, AUCTION, CONSULTANCY or NEWSPAPER.",
      "summary must be a factual one or two sentence summary of the notice, max 400 characters.",
      "eligibility must quote or closely paraphrase the eligibility criteria only when present, else null.",
      "isCorrigendum is true only when the notice is a corrigendum, addendum, amendment or deadline extension.",
      "confidence is your confidence in the classification from 0 to 1.",
      "Return this shape: {\"categorySlug\":null,\"provinceSlug\":null,\"citySlug\":null,\"tenderType\":null,\"summary\":null,\"eligibility\":null,\"isCorrigendum\":null,\"confidence\":0.0}.",
      "",
      `Source: ${input.sourceName}`,
      `Title: ${input.title}`,
      `Organization: ${input.organization ?? "not published"}`,
      "Notice text:",
      input.text.slice(0, 8000),
    ].join("\n");
  }

  private async callProvider(prompt: string): Promise<string | null> {
    const provider = (env.AI_PROVIDER || "").toLowerCase();
    const model = env.AI_MODEL || (provider === "anthropic" ? "claude-3-5-haiku-latest" : provider === "google" ? "gemini-2.0-flash" : "gpt-4o-mini");
    const timeout = AbortSignal.timeout(25_000);

    if (provider === "anthropic") {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.AI_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 900,
          temperature: 0,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: timeout,
      });
      if (!response.ok) throw new Error(`Anthropic HTTP ${response.status}`);
      const data = (await response.json()) as { content?: Array<{ text?: string }> };
      return data.content?.map((part) => part.text ?? "").join("") ?? null;
    }

    if (provider === "google") {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.AI_API_KEY)}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, responseMimeType: "application/json" },
          }),
          signal: timeout,
        },
      );
      if (!response.ok) throw new Error(`Google AI HTTP ${response.status}`);
      const data = (await response.json()) as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      return data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? null;
    }

    const base =
      env.AI_BASE_URL ||
      (provider === "openrouter" ? "https://openrouter.ai/api/v1" : "https://api.openai.com/v1");
    const response = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.AI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
      signal: timeout,
    });
    if (!response.ok) throw new Error(`AI HTTP ${response.status}`);
    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    return data.choices?.[0]?.message?.content ?? null;
  }

  async enrich(input: AiEnrichmentInput): Promise<AiResult | null> {
    if (!this.enabled) return null;
    if (input.text.trim().length < 80) return null;
    try {
      const response = await this.callProvider(this.buildPrompt(input));
      if (!response) return null;
      const parsed = aiResultSchema.safeParse(extractJson(response));
      if (!parsed.success) {
        this.logger.warn(`AI returned an invalid classification: ${parsed.error.issues[0]?.message ?? "unknown"}`);
        return null;
      }
      const result = parsed.data;
      const allowedCategories = new Set(input.categories.map((entry) => entry.slug));
      const allowedProvinces = new Set(input.provinces.map((entry) => entry.slug));
      const allowedCities = new Set(input.cities.map((entry) => entry.slug));
      if (result.categorySlug && !allowedCategories.has(result.categorySlug)) result.categorySlug = null;
      if (result.provinceSlug && !allowedProvinces.has(result.provinceSlug)) result.provinceSlug = null;
      if (result.citySlug && !allowedCities.has(result.citySlug)) result.citySlug = null;
      if (result.summary) result.summary = oneLine(result.summary).slice(0, 500);
      if (result.eligibility) result.eligibility = oneLine(result.eligibility).slice(0, 1000);
      return result;
    } catch (error) {
      this.logger.warn(`AI classification failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }
}
