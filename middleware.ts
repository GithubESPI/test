import { NextResponse } from "next/server";

export function middleware() {
  const response = NextResponse.next();

  // ✅ CORS limité au domaine de l'application
  // https://bulletin.groupe-espi.fr/
  const allowedOrigin = process.env.NEXTAUTH_URL || "https://bulletin.groupe-espi.fr";

  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token");

  return response;
}

export const config = {
  matcher: "/api/:path*",
};