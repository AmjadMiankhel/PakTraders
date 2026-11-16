import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Resolve from this file rather than process.cwd(): managed hosts and custom
// servers can start the process from the repository root, which previously made
// the tracing root point outside the project.
const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../..");

// The monorepo keeps one .env at the root. Load it for server-side rendering and
// for NEXT_PUBLIC_* values that Next inlines at build time.
loadEnv({ path: path.join(repoRoot, ".env"), override: false });
loadEnv({ path: path.join(appDir, ".env.local"), override: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: repoRoot,
  experimental: {
    optimizePackageImports: ["lucide-react"],
    serverActions: {
      // Tender notice uploads go through a server action to the API.
      bodySizeLimit: "26mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
