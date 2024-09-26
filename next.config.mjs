/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https", // Spécifiez le protocole (http ou https)
        hostname: "assets.dewatermark.ai", // Le nom de domaine des images externes
      },
    ],
  },
};

export default nextConfig;
