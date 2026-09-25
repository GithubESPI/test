import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true, // gzip activé
  // Ces packages doivent rester externes (non-bundlés par webpack) pour éviter
  // les erreurs de chunk-splitting en production (returnNaN, TypeError undefined.aa)
  serverExternalPackages: [
    "@pdf-lib/fontkit",
    "pdf-lib",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
    },
  },
  // Optimisation des images (si tu en utilises un jour)
  images: {
    formats: ["image/avif", "image/webp"],
  },
};

export default nextConfig;