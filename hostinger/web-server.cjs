"use strict";

/**
 * Hostinger Web App entry point for the Pak Tenders website.
 *
 * Hostinger's managed Node.js hosting starts the process it is given, sets PORT,
 * and stops the process after a period without traffic. The Next.js standalone
 * preset does not understand this pnpm workspace layout (the server is emitted
 * under .next/standalone/apps/web), so the deployment runs as application type
 * "Other" with this file as the entry point and `next`'s programmatic server.
 *
 * Build:  pnpm build:hostinger:web
 * Entry:  hostinger/web-server.cjs
 */

const http = require("node:http");
const path = require("node:path");

process.env.NODE_ENV = "production";

const appDir = path.join(__dirname, "..", "apps", "web");
const hostname = "0.0.0.0";
const port = Number(process.env.PORT) || 3000;

let next;
try {
  next = require(path.join(appDir, "node_modules", "next"));
} catch (error) {
  console.error(
    "[web] Next.js is not installed. Hostinger must run `pnpm install` before `pnpm build:hostinger:web`.",
  );
  throw error;
}

const app = next({ dev: false, dir: appDir, hostname, port });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    const server = http.createServer((request, response) => handle(request, response));

    server.listen(port, hostname, () => {
      console.log(`[web] Pak Tenders website listening on http://${hostname}:${port}`);
    });

    const shutdown = (signal) => {
      console.log(`[web] ${signal} received, closing the server`);
      server.close(() => process.exit(0));
      setTimeout(() => process.exit(0), 10_000).unref();
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  })
  .catch((error) => {
    console.error("[web] Failed to start Next.js:", error);
    process.exit(1);
  });
