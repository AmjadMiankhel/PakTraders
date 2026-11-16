"use strict";

/**
 * Hostinger Web App entry point for the Pak Tenders API.
 *
 * Hostinger sets PORT and may not set NODE_ENV, so production mode is forced
 * here. The compiled NestJS bootstrap reads PORT itself.
 *
 * Build:  pnpm build:hostinger:api
 * Entry:  hostinger/api-server.cjs
 */

process.env.NODE_ENV = "production";

require("../apps/api/dist/main.js");
