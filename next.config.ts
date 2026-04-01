import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',

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

  // ✅ Timeout global pour toutes les API routes (en secondes)
  serverExternalPackages: ['@prisma/client'],

  experimental: {
    // Coupe les requêtes API qui traînent trop longtemps
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

export default nextConfig;