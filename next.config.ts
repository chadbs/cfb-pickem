import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Team logos come straight from ESPN's CDN.
    remotePatterns: [{ protocol: "https", hostname: "a.espncdn.com" }],
  },
  // The libsql client is a native/node module — keep it out of the bundle.
  serverExternalPackages: ["@libsql/client"],
};

export default nextConfig;
