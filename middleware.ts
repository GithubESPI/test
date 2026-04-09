import { getToken } from "next-auth/jwt";
import { NextRequest, NextResponse } from "next/server";

// ✅ Mise à jour : Ajout des routes Swagger dans les routes publiques
const PUBLIC_ROUTES = [
  "/api/auth",
  "/api/health",
  "/api/docs", // ✅ Autorise l'accès au JSON de Swagger
  "/docs",     // ✅ Autorise l'accès à l'interface visuelle
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Routes publiques — pas de vérification
  const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
  if (isPublic) {
    return NextResponse.next();
  }

  // ✅ Vérification du token JWT
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
  });

  if (!token) {
    // ✅ Redirige vers la page de connexion si non authentifié
    return NextResponse.redirect(new URL("/", request.url));
  }

  const response = NextResponse.next();

  // ✅ CORS restrictif — uniquement ton domaine
  const allowedOrigin = process.env.NEXTAUTH_URL || "http://localhost:3000";
  response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
  response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type, X-Auth-Token");

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/configure/:path*",
    "/home/:path*",
    "/docs/:path*", // ✅ Ajouté pour être sûr que le middleware traite aussi cette route
  ],
};