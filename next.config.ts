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
  webpack: (config) => {
    config.externals.push({
      "pdf-lib": "pdf-lib",
      jszip: "jszip",
      canvas: "canvas",
    });
    return config;
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
