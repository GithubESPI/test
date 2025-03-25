import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.dewatermark.ai",
      },
    ],
  },
  experimental: {
    turbo: {
      rules: {
        // Configuration des externals pour Turbopack
        external: ["pdf-lib", "jszip", "canvas"],
      },
    },
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
};

export default nextConfig;
