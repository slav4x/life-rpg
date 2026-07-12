import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image minimal (see SPEC §16).
  output: "standalone",
  reactStrictMode: true,
  // Allow the local dev server to be reached via these hosts (dev-only).
  allowedDevOrigins: ["localhost", "127.0.0.1"],
};

export default nextConfig;
