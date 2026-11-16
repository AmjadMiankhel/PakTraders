import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import { extname, join, normalize, resolve, sep } from "node:path";
import { Injectable, Logger } from "@nestjs/common";
import { loadEnv } from "@paktenders/config";
import type { SourceDocument } from "@paktenders/database";
import { PrismaService } from "../../../common/prisma/prisma.service";
import type { SourceConfig, StoredDocument } from "../collection.types";
import type { CollectionHttpClient } from "../connectors/http-client";
import { OcrService, type TextExtractionResult } from "./ocr.service";

const env = loadEnv();

const MIME_EXTENSIONS: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/jpg": ".jpg",
  "image/webp": ".webp",
  "image/tiff": ".tiff",
  "text/plain": ".txt",
  "text/html": ".html",
};

const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".txt": "text/plain",
  ".html": "text/html",
  ".htm": "text/html",
};

function sha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

function safeSegment(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9-_]/g, "-").replace(/-+/g, "-").slice(0, 60) || "source";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

@Injectable()
export class DocumentExtractorService {
  private readonly logger = new Logger(DocumentExtractorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ocr: OcrService,
  ) {}

  get storageRoot(): string {
    return resolve(process.env.COLLECTION_STORAGE_DIR || join(process.cwd(), "storage", "collection"));
  }

  resolveStoragePath(relativePath: string): string | null {
    const root = this.storageRoot;
    const candidate = resolve(root, normalize(relativePath));
    if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) return null;
    return candidate;
  }

  /**
   * Stores a document that was downloaded by a connector (an HTTP response or
   * an email attachment), extracts its text and records it in PostgreSQL.
   * The original bytes are always kept so the extracted text can be audited.
   */
  async storeDocumentBuffer(input: {
    source: SourceConfig;
    runId: string;
    buffer: Buffer;
    fileName: string;
    mimeType: string;
    url: string;
    finalUrl: string;
    httpStatus: number;
  }): Promise<{ document: SourceDocument; stored: StoredDocument }> {
    const { source, runId, buffer, fileName, mimeType, url, finalUrl, httpStatus } = input;
    const hash = sha256(buffer);
    const extension =
      MIME_EXTENSIONS[mimeType] ??
      (EXTENSION_MIME[extname(fileName).toLowerCase()] ? extname(fileName).toLowerCase() : ".bin");
    const date = new Date();
    const folder = `${safeSegment(source.code)}/${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const relativePath = `${folder}/${hash}${extension}`;
    const absolutePath = join(this.storageRoot, relativePath);
    await fs.mkdir(join(this.storageRoot, folder), { recursive: true });
    try {
      await fs.access(absolutePath);
    } catch {
      await fs.writeFile(absolutePath, buffer);
    }

    const extraction = await this.extractContent(buffer, mimeType);
    const stored: StoredDocument = {
      id: "",
      url,
      finalUrl,
      fileName,
      mimeType,
      httpStatus,
      contentLength: buffer.byteLength,
      sha256: hash,
      storagePath: relativePath,
      text: extraction.text.slice(0, 500_000),
      textLanguage: extraction.language,
      pageCount: extraction.pageCount,
      pages: extraction.pages,
      ocrStatus: extraction.ocrStatus,
      ocrConfidence: extraction.ocrConfidence,
      extractionConfidence: extraction.extractionConfidence,
      error: null,
    };

    const document = await this.prisma.client.sourceDocument.create({
      data: {
        sourceId: source.id,
        runId,
        url,
        finalUrl,
        fileName,
        mimeType,
        httpStatus,
        contentLength: buffer.byteLength,
        sha256: hash,
        storagePath: relativePath,
        textContent: stored.text,
        textLanguage: extraction.language,
        pageCount: extraction.pageCount,
        ocrStatus: extraction.ocrStatus,
        ocrConfidence: extraction.ocrConfidence,
        extractionConfidence: extraction.extractionConfidence,
        error: extraction.ocrStatus === "FAILED" ? "OCR failed; the original document is stored." : null,
      },
    });
    stored.id = document.id;
    return { document, stored };
  }

  async fetchDocument(input: {
    source: SourceConfig;
    runId: string;
    http: CollectionHttpClient;
    url: string;
    maxBytes: number;
  }): Promise<{ document: SourceDocument; stored: StoredDocument } | null> {
    const { source, runId, http, url, maxBytes } = input;
    try {
      const response = await http.getBuffer(url, maxBytes);
      const buffer = response.body;
      const headerMime = response.contentType?.split(";")[0]?.trim().toLowerCase() ?? "";
      const urlExtension = extname(new URL(response.finalUrl).pathname).toLowerCase();
      const sniffedMime = buffer.subarray(0, 5).toString("latin1") === "%PDF-" ? "application/pdf" : "";
      const mimeType = sniffedMime || headerMime || EXTENSION_MIME[urlExtension] || "application/octet-stream";
      const fileName =
        decodeURIComponent(new URL(response.finalUrl).pathname.split("/").pop() || `document${urlExtension}`) ||
        `document${urlExtension}`;
      return await this.storeDocumentBuffer({
        source,
        runId,
        buffer,
        fileName: fileName || "document",
        mimeType,
        url,
        finalUrl: response.finalUrl,
        httpStatus: response.status,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Document download failed for ${source.code}: ${message}`);
      try {
        const document = await this.prisma.client.sourceDocument.create({
          data: {
            sourceId: source.id,
            runId,
            url,
            ocrStatus: "UNSUPPORTED",
            error: message.slice(0, 2000),
          },
        });
        return {
          document,
          stored: {
            id: document.id,
            url,
            finalUrl: url,
            fileName: url.split("/").pop() ?? "document",
            mimeType: "application/octet-stream",
            httpStatus: 0,
            contentLength: 0,
            sha256: "",
            storagePath: "",
            text: "",
            textLanguage: null,
            pageCount: 0,
            pages: [],
            ocrStatus: "UNSUPPORTED",
            ocrConfidence: null,
            extractionConfidence: null,
            error: message,
          },
        };
      } catch (dbError) {
        this.logger.error(
          `Could not record failed document for ${source.code}: ${dbError instanceof Error ? dbError.message : String(dbError)}`,
        );
        return null;
      }
    }
  }

  async extractContent(buffer: Buffer, mimeType: string): Promise<TextExtractionResult> {
    if (mimeType === "application/pdf") return this.ocr.extractPdf(buffer);
    if (mimeType.startsWith("image/")) return this.ocr.extractImage(buffer);
    if (mimeType === "text/html" || mimeType === "application/xhtml+xml") {
      const text = stripHtml(buffer.toString("utf8"));
      return {
        text,
        pages: text ? [{ page: 1, text, confidence: 1 }] : [],
        pageCount: 1,
        ocrUsed: false,
        ocrStatus: "NOT_REQUIRED",
        ocrConfidence: null,
        extractionConfidence: 0.8,
        language: /[\u0600-\u06ff]/.test(text) ? "ur" : "en",
      };
    }
    if (mimeType.startsWith("text/")) {
      const text = buffer.toString("utf8").trim();
      return {
        text,
        pages: text ? [{ page: 1, text, confidence: 1 }] : [],
        pageCount: 1,
        ocrUsed: false,
        ocrStatus: "NOT_REQUIRED",
        ocrConfidence: null,
        extractionConfidence: 0.85,
        language: /[\u0600-\u06ff]/.test(text) ? "ur" : "en",
      };
    }
    return {
      text: "",
      pages: [],
      pageCount: 0,
      ocrUsed: false,
      ocrStatus: "UNSUPPORTED",
      ocrConfidence: null,
      extractionConfidence: null,
      language: null,
    };
  }

  async extractPlainText(buffer: Buffer): Promise<TextExtractionResult> {
    return this.extractContent(buffer, "text/plain");
  }

  async readStoredFile(relativePath: string): Promise<Buffer | null> {
    const absolutePath = this.resolveStoragePath(relativePath);
    if (!absolutePath) return null;
    try {
      return await fs.readFile(absolutePath);
    } catch {
      return null;
    }
  }
}
