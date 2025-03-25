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
  // Configuration pour l'API
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "/api/:path*",
      },
    ];
  },
  // Configuration expérimentale pour les packages externes
  experimental: {
    serverComponentsExternalPackages: ["pdf-lib", "fs", "path", "jszip"],
  },
  // Configuration runtime pour le serveur
  serverRuntimeConfig: {
    apiTimeout: 120000, // 120 secondes
  },
  // Variables d'environnement pour augmenter la mémoire disponible
  env: {
    NODE_OPTIONS: "--max-old-space-size=4096",
  },
  poweredByHeader: false,
  compress: true,
};

export default nextConfig;
