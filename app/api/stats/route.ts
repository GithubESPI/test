import { prisma } from "@/lib/db/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Récupère l'utilisateur courant d'abord
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { id: true, hasSeenGuide: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
    }

    const [bulletinsThisMonth, groupesThisMonth, campusCount] = await Promise.all([
      // Bulletins générés ce mois par CET utilisateur
      prisma.generation.aggregate({
        _sum: { nbBulletins: true },
        where: {
          userId: currentUser.id,
          createdAt: { gte: startOfMonth },
        },
      }),
      // Groupes uniques traités ce mois par CET utilisateur
      prisma.generation.findMany({
        where: {
          userId: currentUser.id,
          createdAt: { gte: startOfMonth },
        },
        select: { groupe: true },
        distinct: ["groupe"],
      }),
      // Campus uniques de CET utilisateur
      prisma.generation.findMany({
        where: { userId: currentUser.id },
        select: { campus: true },
        distinct: ["campus"],
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        bulletinsThisMonth: bulletinsThisMonth._sum.nbBulletins ?? 0,
        groupesThisMonth: groupesThisMonth.length,
        campusActifs: campusCount.length,
        hasSeenGuide: currentUser.hasSeenGuide ?? false,
      },
    });
  } catch (error) {
    console.error("Erreur stats:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}