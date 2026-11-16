/**
 * Loads the monorepo root .env before any module reads process.env.
 * Imported first in main.ts. Existing environment variables always win, so
 * production/platform configuration is never overridden by a local file.
 */
import { resolve } from "node:path";
import { config } from "dotenv";

// src/env.ts and dist/env.js are both one level below apps/api.
config({ path: resolve(__dirname, "../../../.env") });
config();
