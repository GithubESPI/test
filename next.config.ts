import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  compress: true, // gzip activé
  eslint: {
    ignoreDuringBuilds: true,
  },
  serverExternalPackages: ["@pdf-lib/fontkit", "pdf-lib"],
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