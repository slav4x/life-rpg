import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output keeps the production Docker image minimal (see SPEC §16).
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
