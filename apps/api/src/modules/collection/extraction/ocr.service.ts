import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import pdfParse from "pdf-parse";
import { pdf as renderPdf } from "pdf-to-img";
import Tesseract from "tesseract.js";

const env = loadEnv();

export interface OcrPage {
  page: number;
  text: string;
  confidence: number | null;
}

export interface TextExtractionResult {
  text: string;
  pages: OcrPage[];
  pageCount: number;
  ocrUsed: boolean;
  ocrStatus: "NOT_REQUIRED" | "PENDING" | "COMPLETED" | "FAILED" | "UNSUPPORTED";
  ocrConfidence: number | null;
  extractionConfidence: number | null;
  language: string | null;
}

const MAX_OCR_PAGES = 8;
const MIN_TEXT_PER_PAGE = 40;

function detectLanguage(text: string): string | null {
  if (/[\u0600-\u06ff]/.test(text)) return "ur";
  if (/[A-Za-z]/.test(text)) return "en";
  return null;
}

@Injectable()
export class OcrService implements OnModuleDestroy {
  private readonly logger = new Logger(OcrService.name);
  private workerPromise: Promise<Tesseract.Worker | null> | null = null;
  private workerFailedAt: number | null = null;

  private get languages(): string {
    const configured = env.OCR_LANGUAGES.split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    return (configured.length > 0 ? configured : ["eng"]).join("+");
  }

  private async getWorker(): Promise<Tesseract.Worker | null> {
    if (!env.OCR_ENABLED) return null;
    if (this.workerFailedAt && Date.now() - this.workerFailedAt < 5 * 60_000) return null;
    if (!this.workerPromise) {
      this.workerPromise = Tesseract.createWorker(this.languages, Tesseract.OEM.LSTM_ONLY, {
        logger: (message) => {
          if (message.status === "recognizing text") return;
          this.logger.debug(`${message.status}${message.progress ? ` ${Math.round(message.progress * 100)}%` : ""}`);
        },
      })
        .then((worker) => worker)
        .catch((error: unknown) => {
          this.workerFailedAt = Date.now();
          this.workerPromise = null;
          this.logger.warn(
            `OCR worker unavailable (${error instanceof Error ? error.message : String(error)}). Scanned documents will be flagged for review.`,
          );
          return null;
        });
    }
    return this.workerPromise;
  }

  async recognizeImage(buffer: Buffer): Promise<{ text: string; confidence: number | null } | null> {
    const worker = await this.getWorker();
    if (!worker) return null;
    try {
      const result = await worker.recognize(buffer);
      return {
        text: result.data.text ?? "",
        confidence: Number.isFinite(result.data.confidence) ? result.data.confidence / 100 : null,
      };
    } catch (error) {
      this.logger.warn(`OCR failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  async extractPdf(buffer: Buffer): Promise<TextExtractionResult> {
    let text = "";
    let pageCount = 0;
    try {
      const parsed = await pdfParse(buffer);
      text = parsed.text ?? "";
      pageCount = parsed.numpages ?? 0;
    } catch (error) {
      this.logger.warn(`PDF text extraction failed: ${error instanceof Error ? error.message : String(error)}`);
    }

    const clean = text.replace(/\u0000/g, "").trim();
    const looksScanned =
      pageCount === 0 ||
      clean.length < Math.max(60, pageCount * MIN_TEXT_PER_PAGE) ||
      (clean.match(/\ufffd/g)?.length ?? 0) > clean.length * 0.05;

    if (!looksScanned) {
      const pages = clean
        ? [{ page: 1, text: clean, confidence: 1 }]
        : [];
      return {
        text: clean,
        pages,
        pageCount,
        ocrUsed: false,
        ocrStatus: "NOT_REQUIRED",
        ocrConfidence: null,
        extractionConfidence: 0.9,
        language: detectLanguage(clean),
      };
    }

    if (!env.OCR_ENABLED) {
      return {
        text: clean,
        pages: clean ? [{ page: 1, text: clean, confidence: null }] : [],
        pageCount,
        ocrUsed: false,
        ocrStatus: "UNSUPPORTED",
        ocrConfidence: null,
        extractionConfidence: clean ? 0.3 : null,
        language: detectLanguage(clean),
      };
    }

    try {
      const document = await renderPdf(buffer, { scale: 2, format: "png" });
      pageCount = document.length || pageCount;
      const pages: OcrPage[] = [];
      let pageNumber = 0;
      for await (const image of document) {
        pageNumber += 1;
        if (pageNumber > MAX_OCR_PAGES) break;
        const recognized = await this.recognizeImage(image);
        if (!recognized) continue;
        pages.push({
          page: pageNumber,
          text: recognized.text.trim(),
          confidence: recognized.confidence,
        });
      }
      await document.destroy();

      const combined = pages.map((page) => page.text).join("\n\n").trim();
      const confidences = pages
        .map((page) => page.confidence)
        .filter((value): value is number => value !== null);
      const averageConfidence =
        confidences.length > 0
          ? confidences.reduce((sum, value) => sum + value, 0) / confidences.length
          : null;
      const ocrStatus: TextExtractionResult["ocrStatus"] = combined
        ? "COMPLETED"
        : pages.length === 0
          ? "FAILED"
          : "COMPLETED";

      return {
        text: combined || clean,
        pages,
        pageCount,
        ocrUsed: true,
        ocrStatus,
        ocrConfidence: averageConfidence,
        extractionConfidence: averageConfidence === null ? 0.45 : Math.min(0.9, averageConfidence),
        language: detectLanguage(combined || clean),
      };
    } catch (error) {
      this.logger.warn(`Scanned PDF OCR failed: ${error instanceof Error ? error.message : String(error)}`);
      return {
        text: clean,
        pages: clean ? [{ page: 1, text: clean, confidence: null }] : [],
        pageCount,
        ocrUsed: false,
        ocrStatus: "FAILED",
        ocrConfidence: null,
        extractionConfidence: clean ? 0.3 : null,
        language: detectLanguage(clean),
      };
    }
  }

  async extractImage(buffer: Buffer): Promise<TextExtractionResult> {
    if (!env.OCR_ENABLED) {
      return {
        text: "",
        pages: [],
        pageCount: 1,
        ocrUsed: false,
        ocrStatus: "UNSUPPORTED",
        ocrConfidence: null,
        extractionConfidence: null,
        language: null,
      };
    }
    const recognized = await this.recognizeImage(buffer);
    if (!recognized) {
      return {
        text: "",
        pages: [],
        pageCount: 1,
        ocrUsed: false,
        ocrStatus: "FAILED",
        ocrConfidence: null,
        extractionConfidence: null,
        language: null,
      };
    }
    return {
      text: recognized.text.trim(),
      pages: [{ page: 1, text: recognized.text.trim(), confidence: recognized.confidence }],
      pageCount: 1,
      ocrUsed: true,
      ocrStatus: "COMPLETED",
      ocrConfidence: recognized.confidence,
      extractionConfidence: recognized.confidence ?? 0.5,
      language: detectLanguage(recognized.text),
    };
  }

  async onModuleDestroy(): Promise<void> {
    const worker = await this.workerPromise;
    if (worker) await worker.terminate();
  }
}
