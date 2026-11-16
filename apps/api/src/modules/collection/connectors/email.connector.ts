import { ImapFlow } from "imapflow";
import { simpleParser, type ParsedMail } from "mailparser";
import { loadEnv } from "@paktenders/config";
import type { RawTenderItem } from "../collection.types";
import { oneLine } from "../extraction/date-utils";
import { parseReferenceFromText } from "../extraction/parse-helpers";
import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";

export interface EmailConnectorConfig {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  mailbox?: string;
  passwordEnv?: string;
  sinceDays?: number;
  subjectPattern?: string;
}

const PDF_PATTERN = /https?:\/\/[^\s"'<>]+?\.pdf(?:\?[^\s"'<>]*)?/gi;
const ALLOWED_ATTACHMENT = /^(application\/pdf|image\/(png|jpe?g|webp|tiff?))$/i;

function bodyText(mail: ParsedMail): string {
  const text = mail.text ?? "";
  if (text.trim()) return text.trim();
  const html = typeof mail.html === "string" ? mail.html : "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .trim();
}

/**
 * Email feed connector. Reads a mailbox that the administrator has explicitly
 * configured (for example a dedicated tenders@ inbox) over IMAP. Credentials
 * are read from environment variables, never from the database. When they are
 * missing the source fails with MISSING_CREDENTIAL and stays disabled.
 */
export const emailConnector: SourceConnector = {
  key: "email",
  label: "Email tender feed (IMAP)",
  supportsEnrichment: false,

  async collect(ctx: ConnectorContext) {
    const config = (ctx.source.config ?? {}) as EmailConnectorConfig;
    const host = config.host ?? process.env.COLLECTION_EMAIL_HOST ?? "";
    const user = config.user ?? process.env.COLLECTION_EMAIL_USER ?? "";
    const passwordEnv = config.passwordEnv ?? "COLLECTION_EMAIL_PASSWORD";
    const password = process.env[passwordEnv] ?? "";
    if (!host || !user || !password) {
      throw new ConnectorError(
        `Email feed is not configured. Set the host, user and the ${passwordEnv} environment variable to enable it.`,
        { code: "MISSING_CREDENTIAL", retryable: false },
      );
    }

    const sinceDays = Math.min(Math.max(config.sinceDays ?? 3, 1), 30);
    const client = new ImapFlow({
      host,
      port: config.port ?? 993,
      secure: config.secure ?? true,
      auth: { user, pass: password },
      logger: false,
    });

    const items: RawTenderItem[] = [];
    const notes: string[] = [];
    try {
      await client.connect();
      const lock = await client.getMailboxLock(config.mailbox ?? "INBOX");
      try {
        const since = new Date(Date.now() - sinceDays * 86_400_000);
        const subjectPattern = config.subjectPattern ? new RegExp(config.subjectPattern, "i") : null;
        for await (const message of client.fetch({ since }, { envelope: true, source: true, uid: true })) {
          if (items.length >= ctx.maxItems) break;
          if (!message.source) continue;
          const mail = await simpleParser(message.source);
          const subject = oneLine(mail.subject ?? "");
          if (!subject) continue;
          if (subjectPattern && !subjectPattern.test(subject)) continue;

          const body = bodyText(mail);
          const maxAttachmentBytes = loadEnv().COLLECTION_MAX_DOCUMENT_MB * 1024 * 1024;
          const attachments = (mail.attachments ?? []).filter(
            (attachment) =>
              ALLOWED_ATTACHMENT.test(attachment.contentType ?? "") &&
              (attachment.size ?? attachment.content?.byteLength ?? 0) <= maxAttachmentBytes,
          );

          const attachmentBuffers = attachments
            .filter((attachment) => attachment.content && attachment.content.byteLength > 0)
            .slice(0, 5)
            .map((attachment) => ({
              fileName: oneLine(attachment.filename ?? `attachment-${Date.now()}`) || "attachment",
              mimeType: attachment.contentType ?? "application/octet-stream",
              data: attachment.content as Buffer,
            }));

          const documentUrls = Array.from(new Set(body.match(PDF_PATTERN) ?? []));
          const from = mail.from?.value?.[0]?.address ?? null;
          const reference = parseReferenceFromText(`${subject} ${body}`);
          const externalId = message.uid
            ? `uid:${message.uid}`
            : `${mail.messageId ?? subject}-${mail.date?.toISOString() ?? ""}`;

          items.push({
            externalId,
            sourceUrl: `email://${config.mailbox ?? "INBOX"}/${externalId}`,
            title: subject,
            referenceNumber: reference ?? undefined,
            description: body || undefined,
            publishedAt: mail.date ? mail.date.toISOString() : undefined,
            contactEmail: from ?? undefined,
            documentUrls: documentUrls.length > 0 ? documentUrls : undefined,
            attachments: attachmentBuffers.length > 0 ? attachmentBuffers : undefined,
            fieldConfidence: { title: 0.85, description: body ? 0.7 : undefined, contactEmail: from ? 0.8 : undefined },
            raw: {
              from,
              to: mail.to,
              messageId: mail.messageId,
              date: mail.date?.toISOString() ?? null,
              attachmentNames: attachments.map((attachment) => attachment.filename ?? "").filter(Boolean),
            },
          });
        }
      } finally {
        lock.release();
      }
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      throw new ConnectorError(
        `IMAP mailbox could not be read: ${error instanceof Error ? error.message : String(error)}`,
        { code: "IMAP_FAILED" },
      );
    } finally {
      try {
        await client.logout();
      } catch {
        // The connection may already be closed after a failure.
      }
    }

    if (items.length === 0) notes.push(`No matching messages in the last ${sinceDays} day(s).`);
    return { items, pagesFetched: 1, notes };
  },
};
