import type { NextConfig } from "next";

// Security headers (SPEC §9.3). Framing is intentionally NOT restricted:
// Telegram embeds the Mini App in a WebView / iframe, so X-Frame-Options and a
// restrictive frame-ancestors CSP would break it.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

if (process.env.NODE_ENV === "production") {
  securityHeaders.push({
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  });
}

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image minimal (see SPEC §16).
  output: "standalone",
  reactStrictMode: true,
  // Allow the local dev server to be reached via these hosts (dev-only).
  allowedDevOrigins: ["localhost", "127.0.0.1"],
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
