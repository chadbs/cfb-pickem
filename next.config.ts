import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Team logos come straight from ESPN's CDN.
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
  // Keep the Postgres driver out of the bundle; it's a server-only dependency.
  serverExternalPackages: ["postgres"],
};

export default nextConfig;
