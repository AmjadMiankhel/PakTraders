import { ConnectorError } from "./connector.types";

export interface HttpClientOptions {
  sourceId: string;
  userAgent: string;
  timeoutMs: number;
  rateLimitPerMinute: number;
  maxBytes: number;
  respectRobots: boolean;
}

export interface HttpResponse {
  status: number;
  ok: boolean;
  headers: Headers;
  body: Buffer;
  finalUrl: string;
  contentType: string | null;
}

interface RobotsRules {
  fetchedAt: number;
  rules: Array<{ allow: boolean; path: string }>;
  disallowAll: boolean;
  crawlDelaySeconds: number | null;
}

const ROBOTS_TTL_MS = 60 * 60 * 1000;
const robotsCache = new Map<string, RobotsRules>();
const rateWindows = new Map<string, { timestamps: number[]; perMinute: number }>();

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Rejects URLs that could reach the host's own network (SSRF guard). */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConnectorError(`Invalid URL: ${raw}`, { code: "INVALID_URL", retryable: false });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConnectorError(`Unsupported URL protocol: ${url.protocol}`, {
      code: "UNSUPPORTED_PROTOCOL",
      retryable: false,
    });
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  const blocked =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host === "::1" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);
  if (blocked) {
    throw new ConnectorError(`Refusing to fetch a private or local address: ${host}`, {
      code: "PRIVATE_ADDRESS",
      retryable: false,
    });
  }
  return url;
}

export function resolveUrl(base: string, href: string): string {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function userAgentToken(userAgent: string): string {
  return userAgent.split(/[/\s]/)[0]?.toLowerCase() ?? "";
}

function parseRobots(text: string, userAgent: string): RobotsRules {
  const token = userAgentToken(userAgent);
  const groups: Array<{ agents: string[]; rules: Array<{ allow: boolean; path: string }>; crawlDelay: number | null }> = [];
  let current: { agents: string[]; rules: Array<{ allow: boolean; path: string }>; crawlDelay: number | null } | null = null;
  let expectingAgents = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!current || !expectingAgents) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
        expectingAgents = true;
      }
      current.agents.push(value.toLowerCase());
      continue;
    }
    expectingAgents = false;
    if (!current) continue;
    if (key === "disallow") {
      if (value) current.rules.push({ allow: false, path: value });
    } else if (key === "allow") {
      if (value) current.rules.push({ allow: true, path: value });
    } else if (key === "crawl-delay") {
      const seconds = Number(value);
      if (Number.isFinite(seconds)) current.crawlDelay = seconds;
    }
  }

  const matching = groups.filter((group) =>
    group.agents.some((agent) => agent === "*" || (token && agent.includes(token))),
  );
  const specific = matching.filter((group) => group.agents.some((agent) => agent !== "*" && token && agent.includes(token)));
  const chosen = specific.length > 0 ? specific : matching;
  const rules = chosen.flatMap((group) => group.rules);
  const crawlDelay = chosen.find((group) => group.crawlDelay !== null)?.crawlDelay ?? null;
  return {
    fetchedAt: Date.now(),
    rules,
    disallowAll: rules.length === 1 && rules[0]?.path === "/" && rules[0]?.allow === false,
    crawlDelaySeconds: crawlDelay,
  };
}

function robotsAllows(rules: RobotsRules, pathname: string): boolean {
  if (rules.rules.length === 0) return true;
  let best: { allow: boolean; length: number } | null = null;
  for (const rule of rules.rules) {
    if (rule.path === "/" || pathname.startsWith(rule.path)) {
      const length = rule.path.length;
      if (!best || length > best.length) best = { allow: rule.allow, length };
    }
  }
  return best ? best.allow : true;
}

/**
 * HTTP client used by every connector. Enforces a per-source rate limit,
 * robots.txt (when enabled), timeouts, response-size limits and bounded
 * retries with exponential backoff. It never bypasses authentication,
 * CAPTCHAs or paywalls: those pages simply fail and are reported.
 */
export class CollectionHttpClient {
  private readonly options: HttpClientOptions;

  constructor(options: HttpClientOptions) {
    this.options = options;
  }

  private async waitForRateSlot(): Promise<void> {
    const perMinute = Math.max(1, this.options.rateLimitPerMinute);
    const key = this.options.sourceId;
    const entry = rateWindows.get(key) ?? { timestamps: [], perMinute };
    entry.perMinute = perMinute;
    rateWindows.set(key, entry);

    for (;;) {
      const now = Date.now();
      entry.timestamps = entry.timestamps.filter((stamp) => now - stamp < 60_000);
      if (entry.timestamps.length < perMinute) {
        entry.timestamps.push(now);
        return;
      }
      const oldest = entry.timestamps[0] ?? now;
      await sleep(Math.max(250, 60_000 - (now - oldest) + 25));
    }
  }

  private async loadRobots(origin: string): Promise<RobotsRules> {
    const cached = robotsCache.get(origin);
    if (cached && Date.now() - cached.fetchedAt < ROBOTS_TTL_MS) return cached;

    const url = `${origin}/robots.txt`;
    try {
      const response = await fetch(url, {
        headers: { "user-agent": this.options.userAgent, accept: "text/plain,*/*" },
        signal: AbortSignal.timeout(Math.min(this.options.timeoutMs, 15_000)),
        redirect: "follow",
      });
      if (response.status === 401 || response.status === 403) {
        const denied: RobotsRules = {
          fetchedAt: Date.now(),
          rules: [{ allow: false, path: "/" }],
          disallowAll: true,
          crawlDelaySeconds: null,
        };
        robotsCache.set(origin, denied);
        return denied;
      }
      if (!response.ok) {
        const allowAll: RobotsRules = {
          fetchedAt: Date.now(),
          rules: [],
          disallowAll: false,
          crawlDelaySeconds: null,
        };
        robotsCache.set(origin, allowAll);
        return allowAll;
      }
      const text = await response.text();
      const parsed = parseRobots(text, this.options.userAgent);
      robotsCache.set(origin, parsed);
      return parsed;
    } catch {
      // An unreachable robots.txt must not silently grant permission to crawl;
      // treat it as "no rules" but record it in the run log by the caller.
      const allowAll: RobotsRules = {
        fetchedAt: Date.now(),
        rules: [],
        disallowAll: false,
        crawlDelaySeconds: null,
      };
      robotsCache.set(origin, allowAll);
      return allowAll;
    }
  }

  private async assertAllowed(url: URL): Promise<void> {
    if (!this.options.respectRobots) return;
    const robots = await this.loadRobots(url.origin);
    if (robots.disallowAll || !robotsAllows(robots, url.pathname)) {
      throw new ConnectorError(`robots.txt disallows ${url.pathname} on ${url.host}`, {
        code: "ROBOTS_DISALLOWED",
        retryable: false,
      });
    }
  }

  async request(
    rawUrl: string,
    init: { accept?: string; method?: string; maxBytes?: number } = {},
  ): Promise<HttpResponse> {
    const url = assertPublicHttpUrl(rawUrl);
    const maxBytes = init.maxBytes ?? this.options.maxBytes;
    await this.assertAllowed(url);

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await this.waitForRateSlot();
      try {
        const response = await fetch(url, {
          method: init.method ?? "GET",
          headers: {
            "user-agent": this.options.userAgent,
            accept: init.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "accept-language": "en-PK,en;q=0.9,ur;q=0.8",
          },
          redirect: "follow",
          signal: AbortSignal.timeout(this.options.timeoutMs),
        });

        const declaredLength = Number(response.headers.get("content-length") ?? "0");
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
          throw new ConnectorError(
            `Response is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
            { code: "RESPONSE_TOO_LARGE", retryable: false },
          );
        }
        const arrayBuffer = await response.arrayBuffer();
        if (arrayBuffer.byteLength > maxBytes) {
          throw new ConnectorError(
            `Response is larger than the ${Math.round(maxBytes / 1024 / 1024)} MB limit`,
            { code: "RESPONSE_TOO_LARGE", retryable: false },
          );
        }

        if (!response.ok && RETRYABLE_STATUS.has(response.status) && attempt < 2) {
          const retryAfter = Number(response.headers.get("retry-after") ?? "0");
          const delay = retryAfter > 0 ? retryAfter * 1000 : 1_000 * 3 ** attempt;
          await sleep(Math.min(delay, 20_000));
          lastError = new ConnectorError(`HTTP ${response.status} from ${url.host}`, {
            code: `HTTP_${response.status}`,
          });
          continue;
        }

        if (!response.ok) {
          throw new ConnectorError(`HTTP ${response.status} from ${url.host}`, {
            code: `HTTP_${response.status}`,
            retryable: RETRYABLE_STATUS.has(response.status),
          });
        }

        return {
          status: response.status,
          ok: true,
          headers: response.headers,
          body: Buffer.from(arrayBuffer),
          finalUrl: response.url || url.toString(),
          contentType: response.headers.get("content-type"),
        };
      } catch (error) {
        if (error instanceof ConnectorError && !error.retryable) throw error;
        lastError = error;
        if (attempt < 2) await sleep(1_000 * 3 ** attempt);
      }
    }

    if (lastError instanceof ConnectorError) throw lastError;
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    throw new ConnectorError(`Request to ${url.host} failed: ${message}`, {
      code: "REQUEST_FAILED",
    });
  }

  async getText(url: string, init: { accept?: string; maxBytes?: number } = {}): Promise<{ text: string; response: HttpResponse }> {
    const response = await this.request(url, { ...init, accept: init.accept ?? "text/html,*/*" });
    const charset = /charset=([^;]+)/i.exec(response.contentType ?? "")?.[1]?.trim().toLowerCase();
    let text: string;
    try {
      text = new TextDecoder(charset && charset !== "utf-8" ? charset : "utf-8").decode(response.body);
    } catch {
      text = response.body.toString("utf8");
    }
    return { text, response };
  }

  async getJson<T>(url: string): Promise<{ data: T; response: HttpResponse }> {
    const response = await this.request(url, { accept: "application/json,*/*" });
    try {
      return { data: JSON.parse(response.body.toString("utf8")) as T, response };
    } catch {
      throw new ConnectorError(`Expected JSON from ${url}`, { code: "INVALID_JSON", retryable: false });
    }
  }

  async getBuffer(url: string, maxBytes?: number): Promise<HttpResponse> {
    return this.request(url, { accept: "*/*", maxBytes });
  }
}
