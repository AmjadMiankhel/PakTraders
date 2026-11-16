import { ConnectorError, type ConnectorContext, type SourceConnector } from "./connector.types";

/**
 * Manual sources are never fetched automatically. An administrator imports
 * their notices through the collection admin screen, and the same extraction,
 * deduplication and review pipeline is applied to the imported record.
 */
export const manualConnector: SourceConnector = {
  key: "manual",
  label: "Manual administrator import",
  supportsEnrichment: false,

  async collect(_ctx: ConnectorContext) {
    throw new ConnectorError(
      "This source is configured for manual import only. Use the collection admin screen to import a notice.",
      { code: "MANUAL_SOURCE", retryable: false },
    );
  },
};
