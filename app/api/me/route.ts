import { prisma } from "@/lib/db/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

export const dynamic = "force-dynamic";

// Informations du compte connecté (menu utilisateur) : uniquement les siennes.
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, createdAt: true },
    });

    // Compte jamais enregistré en base : on renvoie des valeurs vides plutôt qu'une erreur
    if (!user) {
      return NextResponse.json({
        success: true,
        data: { memberSince: null, totalGenerations: 0, totalBulletins: 0, lastGenerationAt: null },
      });
    }

    const [totals, last] = await Promise.all([
      prisma.generation.aggregate({
        where: { userId: user.id },
        _count: true,
        _sum: { nbBulletins: true },
      }),
      prisma.generation.findFirst({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        memberSince: user.createdAt,
        totalGenerations: totals._count,
        totalBulletins: totals._sum.nbBulletins ?? 0,
        lastGenerationAt: last?.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error("Erreur /api/me:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
