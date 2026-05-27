import { prisma } from "@/lib/db/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

// POST — enregistre une nouvelle génération
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const body = await request.json();
    const { campus, groupe, periode, nbBulletins } = body;

    if (!campus || !groupe || !periode || !nbBulletins) {
      return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const generation = await prisma.generation.create({
      data: {
        userId: user.id,
        campus,
        groupe,
        periode,
        nbBulletins: Number(nbBulletins),
      },
    });

    return NextResponse.json({ success: true, data: generation });
  } catch (error) {
    console.error("Erreur création génération:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

// PATCH — marque le guide comme vu
export async function PATCH() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    await prisma.user.update({
      where: { email: session.user.email },
      data: { hasSeenGuide: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Erreur mise à jour guide:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}

// GET — historique des générations de l'utilisateur
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const generations = await prisma.generation.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    return NextResponse.json({ success: true, data: generations });
  } catch (error) {
    console.error("Erreur récupération générations:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}