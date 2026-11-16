import path from "node:path";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// The monorepo keeps one .env at the root. Load it for server-side rendering and
// for NEXT_PUBLIC_* values that Next inlines at build time.
loadEnv({ path: path.resolve(process.cwd(), "../../.env"), override: false });
loadEnv({ path: path.resolve(process.cwd(), ".env.local"), override: true });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(process.cwd(), "../../"),
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
