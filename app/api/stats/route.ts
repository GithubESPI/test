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

    const [bulletinsThisMonth, groupesThisMonth, campusCount, hasSeenGuide] = await Promise.all([
      // Total bulletins générés ce mois
      prisma.generation.aggregate({
        _sum: { nbBulletins: true },
        where: { createdAt: { gte: startOfMonth } },
      }),
      // Groupes uniques traités ce mois
      prisma.generation.findMany({
        where: { createdAt: { gte: startOfMonth } },
        select: { groupe: true },
        distinct: ["groupe"],
      }),
      // Campus uniques au total
      prisma.generation.findMany({
        select: { campus: true },
        distinct: ["campus"],
      }),
      // hasSeenGuide pour l'utilisateur courant
      prisma.user.findUnique({
        where: { email: session.user.email! },
        select: { hasSeenGuide: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        bulletinsThisMonth: bulletinsThisMonth._sum.nbBulletins ?? 0,
        groupesThisMonth: groupesThisMonth.length,
        campusActifs: campusCount.length,
        hasSeenGuide: hasSeenGuide?.hasSeenGuide ?? false,
      },
    });
  } catch (error) {
    console.error("Erreur stats:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}