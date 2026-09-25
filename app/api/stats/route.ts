import { prisma } from "@/lib/db/client";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";

interface CampusProgress {
  campus: string;
  groupes: number;
  bulletins: number;
  derniere: string | null;
}

// « ALT Semestre 1 (2025-2026) » → { nom: "ALT Semestre 1", annee: "2025-2026" }
function parsePeriode(periode: string) {
  const m = periode.match(/^(.*?)\s*\((\d{4}-\d{4})\)\s*$/);
  return m ? { nom: m[1], annee: m[2] } : { nom: periode, annee: "" };
}

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

    const [bulletinsThisMonth, groupesThisMonth, allGenerations, sessionsCache] = await Promise.all([
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
      // Toutes les générations de l'utilisateur (pour l'avancement par période)
      prisma.generation.findMany({
        where: { userId: currentUser.id },
        select: { campus: true, groupe: true, periode: true, nbBulletins: true, createdAt: true },
        orderBy: { createdAt: "desc" },
      }),
      // Années académiques connues d'Yparéo (cache en base, sans appel à Ymag)
      prisma.ymageCache.findUnique({ where: { key: "sessions" }, select: { data: true } }).catch(() => null),
    ]);

    const campusActifs = new Set(allGenerations.map((g) => g.campus)).size;

    // ------------------------------------------------------------------
    // Avancement par période d'évaluation
    // - Campus « attendus » pour une période (ex: « ALT Semestre 1 ») : ceux où l'utilisateur
    //   l'a déjà générée, quelle que soit l'année → un campus 100 % temps plein n'est pas
    //   signalé « à faire » pour une période alternance.
    // - Un campus est « fait » s'il a au moins une génération pour la période ET l'année choisies.
    // ------------------------------------------------------------------
    const campusParNom = new Map<string, Set<string>>();
    for (const g of allGenerations) {
      const { nom } = parsePeriode(g.periode);
      if (!campusParNom.has(nom)) campusParNom.set(nom, new Set());
      campusParNom.get(nom)!.add(g.campus);
    }

    // Année académique en cours d'après Yparéo (dernière dont la date de début est passée)
    let anneeEnCours = "";
    if (Array.isArray(sessionsCache?.data)) {
      const started = (sessionsCache.data as Array<{ NOM_SESSION?: string; DATE_DEB?: string }>)
        .filter((s) => s.NOM_SESSION && /^\d{4}-\d{4}$/.test(s.NOM_SESSION) && s.DATE_DEB && new Date(s.DATE_DEB) <= now)
        .sort((a, b) => new Date(b.DATE_DEB!).getTime() - new Date(a.DATE_DEB!).getTime());
      anneeEnCours = started[0]?.NOM_SESSION ?? "";
    }

    // Périodes proposées : d'abord celles déjà générées (la plus récente en premier),
    // puis les mêmes périodes pour l'année en cours si elles n'ont pas encore été générées.
    // On ne propose que l'année en cours et la précédente (les années plus anciennes n'ont pas
    // d'action possible), et seulement des périodes avec une année (les anciennes générations
    // enregistrées sans année seraient ambiguës).
    const debutAnnee = (annee: string) => parseInt(annee.slice(0, 4), 10);
    const anneeMin = anneeEnCours ? debutAnnee(anneeEnCours) - 1 : 0;
    const proposee = (periode: string) => {
      const { annee } = parsePeriode(periode);
      return annee !== "" && debutAnnee(annee) >= anneeMin;
    };

    const periodes: string[] = [];
    for (const g of allGenerations) {
      if (proposee(g.periode) && !periodes.includes(g.periode)) periodes.push(g.periode);
    }
    if (anneeEnCours) {
      for (const nom of campusParNom.keys()) {
        const label = `${nom} (${anneeEnCours})`;
        if (!periodes.includes(label)) periodes.push(label);
      }
    }

    const parPeriode: Record<string, CampusProgress[]> = {};
    for (const periode of periodes) {
      const { nom } = parsePeriode(periode);
      const rowsPeriode = allGenerations.filter((g) => g.periode === periode);
      const campuses = new Set([...(campusParNom.get(nom) ?? []), ...rowsPeriode.map((g) => g.campus)]);

      parPeriode[periode] = [...campuses]
        .map((campus) => {
          const rows = rowsPeriode.filter((g) => g.campus === campus);
          return {
            campus,
            groupes: new Set(rows.map((r) => r.groupe)).size,
            bulletins: rows.reduce((sum, r) => sum + r.nbBulletins, 0),
            derniere: rows[0]?.createdAt.toISOString() ?? null,
          };
        })
        // À faire d'abord (0 groupe), puis ordre alphabétique
        .sort((a, b) => Number(a.groupes > 0) - Number(b.groupes > 0) || a.campus.localeCompare(b.campus, "fr"));
    }

    return NextResponse.json({
      success: true,
      data: {
        bulletinsThisMonth: bulletinsThisMonth._sum.nbBulletins ?? 0,
        groupesThisMonth: groupesThisMonth.length,
        campusActifs,
        hasSeenGuide: currentUser.hasSeenGuide ?? false,
        progression: {
          periodes,
          defaultPeriode: periodes[0] ?? null, // la période de la génération la plus récente
          parPeriode,
        },
      },
    });
  } catch (error) {
    console.error("Erreur stats:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}
