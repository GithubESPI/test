import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

// Protège toutes les pages de l'app et toutes les API (sauf auth et health) :
// sans session Azure AD valide → 401 pour les API, redirection vers "/" pour les pages.
export async function middleware(req: NextRequest) {
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const loginUrl = new URL("/", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/home/:path*",
    "/configure/:path*",
    "/historique/:path*",
    // Toutes les API sauf /api/auth (NextAuth) et /api/health (sonde Azure)
    "/api/((?!auth|health).*)",
  ],
};
