import type { SourceConfig, RawTenderItem, ConnectorResult } from "../collection.types";
import type { CollectionHttpClient } from "./http-client";

export interface ConnectorLogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface ConnectorContext {
  source: SourceConfig;
  http: CollectionHttpClient;
  logger: ConnectorLogger;
  /** External ids already stored for this source. */
  knownExternalIds: Set<string>;
  /** Hard cap for a single run. */
  maxItems: number;
}

export interface SourceConnector {
  /** Stable key stored on TenderSource.connectorKey. */
  readonly key: string;
  readonly label: string;
  /** Whether enrich() can add detail/document information. */
  readonly supportsEnrichment: boolean;
  /** Retrieve listing records. Must never bypass access controls. */
  collect(ctx: ConnectorContext): Promise<ConnectorResult>;
  /** Optionally load a detail page and return a richer item. */
  enrich?(ctx: ConnectorContext, item: RawTenderItem): Promise<RawTenderItem>;
}

export class ConnectorError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(message: string, options: { code?: string; retryable?: boolean } = {}) {
    super(message);
    this.name = "ConnectorError";
    this.code = options.code ?? "CONNECTOR_ERROR";
    this.retryable = options.retryable ?? true;
  }
}
