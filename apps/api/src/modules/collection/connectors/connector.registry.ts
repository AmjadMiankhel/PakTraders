import { ConnectorError, type SourceConnector } from "./connector.types";
import { csvConnector } from "./csv.connector";
import { documentConnector } from "./document.connector";
import { emailConnector } from "./email.connector";
import { epmsConnector } from "./epms.connector";
import { jsonApiConnector } from "./json-api.connector";
import { manualConnector } from "./manual.connector";
import { rssConnector } from "./rss.connector";
import { tableConnector } from "./table.connector";

const connectors: SourceConnector[] = [
  epmsConnector,
  tableConnector,
  rssConnector,
  jsonApiConnector,
  csvConnector,
  documentConnector,
  emailConnector,
  manualConnector,
];

const byKey = new Map<string, SourceConnector>(connectors.map((connector) => [connector.key, connector]));

/** Resolves a connector by the key stored on TenderSource.connectorKey. */
export function getConnector(key: string): SourceConnector {
  const connector = byKey.get(key);
  if (!connector) {
    throw new ConnectorError(`Unknown connector "${key}".`, { code: "UNKNOWN_CONNECTOR", retryable: false });
  }
  return connector;
}

export function hasConnector(key: string): boolean {
  return byKey.has(key);
}

export function listConnectors(): Array<{
  key: string;
  label: string;
  supportsEnrichment: boolean;
  automated: boolean;
}> {
  return connectors.map((connector) => ({
    key: connector.key,
    label: connector.label,
    supportsEnrichment: connector.supportsEnrichment,
    automated: connector.key !== manualConnector.key,
  }));
}

/** True when the source is fetched by the scheduler rather than imported. */
export function isAutomatedSource(source: { collectionMethod: string; connectorKey: string }): boolean {
  return source.collectionMethod !== "MANUAL_IMPORT" && source.connectorKey !== manualConnector.key;
}
