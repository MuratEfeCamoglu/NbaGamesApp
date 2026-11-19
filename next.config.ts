import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// Basic CSP: images only from self + NBA CDN headshots (ISKELET §5).
const csp = [
  "default-src 'self'",
  "img-src 'self' data: https://cdn.nba.com",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // The project has its own AGENT.md; stop `next dev` from generating AGENTS.md.
  agentRules: false,
  // Native SQLite binding must stay a Node require, not bundled.
  serverExternalPackages: ["better-sqlite3", "@prisma/adapter-better-sqlite3"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "cdn.nba.com", pathname: "/headshots/**" }],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
