import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 1. Indispensable pour Azure : réduit le poids de 500Mo à ~50Mo.
  // Next.js génère un dossier '.next/standalone' autonome.
  output: 'standalone', 

  eslint: {
    // Évite que le déploiement plante pour des erreurs de formatage.
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

  // On retire le bloc 'experimental' s'il pose problème, 
  // car 'output: standalone' se suffit à lui-même pour régler le gros du souci.
};

export default nextConfig;