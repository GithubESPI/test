import { prisma } from "@/lib/db/client";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { RETENTION_DAYS } from "@/lib/storage/retention";
import { fileStorage } from "@/lib/storage/fileStorage";

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
// Paramètres (tous optionnels) : page (défaut 1), pageSize (défaut 20, max 50),
// q (recherche dans groupe / campus / période), campus (filtre exact)
export async function GET(request: NextRequest) {
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

    const sp = request.nextUrl.searchParams;
    const page = Math.max(1, parseInt(sp.get("page") || "1", 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(sp.get("pageSize") || "30", 10) || 30));
    const q = (sp.get("q") || "").trim().slice(0, 100);
    const campus = (sp.get("campus") || "").trim().slice(0, 100);
    const annee = (sp.get("annee") || "").trim().slice(0, 20); // ex: "2025-2026"
    const periodeNom = (sp.get("periodeNom") || "").trim().slice(0, 100); // ex: "ALT Semestre 1"
    const range = sp.get("range") || ""; // today | 7d | 30d

    // Filtre de dates
    let since: Date | null = null;
    const now = new Date();
    if (range === "today") {
      since = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === "7d" || range === "30d") {
      since = new Date(now.getTime() - (range === "7d" ? 7 : 30) * 24 * 3600 * 1000);
    }

    // Les conditions sur "periode" (libellé « ALT Semestre 1 (2025-2026) ») sont combinées avec AND
    const and: object[] = [];
    if (periodeNom) and.push({ periode: { startsWith: periodeNom, mode: "insensitive" as const } });
    if (annee) and.push({ periode: { contains: `(${annee})` } });
    if (q) {
      and.push({
        OR: [
          { groupe: { contains: q, mode: "insensitive" as const } },
          { campus: { contains: q, mode: "insensitive" as const } },
          { periode: { contains: q, mode: "insensitive" as const } },
        ],
      });
    }

    const where = {
      userId: user.id,
      ...(campus && { campus }),
      ...(since && { createdAt: { gte: since } }),
      ...(and.length > 0 ? { AND: and } : {}),
    };

    const readCache = (key: string) =>
      prisma.ymageCache.findUnique({ where: { key }, select: { data: true } }).catch(() => null);

    const [generations, total, distinctRows, sitesCache, sessionsCache, periodsCache] = await Promise.all([
      prisma.generation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.generation.count({ where }),
      // Valeurs réellement présentes dans l'historique de l'utilisateur (pour les filtres)
      prisma.generation.findMany({
        where: { userId: user.id },
        distinct: ["campus", "periode"],
        select: { campus: true, periode: true },
      }),
      // Listes complètes Yparéo (cache en base, sans appel à Ymag) : campus, années, périodes
      readCache("sites"),
      readCache("sessions"),
      readCache("periods"),
    ]);

    // Campus : tous ceux connus d'Yparéo + ceux déjà présents dans l'historique
    const campusSet = new Set<string>(distinctRows.map((r) => r.campus));
    if (Array.isArray(sitesCache?.data)) {
      for (const site of sitesCache.data as Array<{ NOM_SITE?: string }>) {
        if (site?.NOM_SITE) campusSet.add(site.NOM_SITE);
      }
    }

    // Périodes et années : « ALT Semestre 1 (2025-2026) » → nom + année
    const periodeSet = new Set<string>();
    const anneeSet = new Set<string>();
    for (const { periode } of distinctRows) {
      const m = periode.match(/^(.*?)\s*\((\d{4}-\d{4})\)\s*$/);
      if (m) {
        periodeSet.add(m[1]);
        anneeSet.add(m[2]);
      } else {
        periodeSet.add(periode);
      }
    }

    // Années académiques connues d'Yparéo (ex: 2026-2027 avant toute génération)
    if (Array.isArray(sessionsCache?.data)) {
      for (const s of sessionsCache.data as Array<{ NOM_SESSION?: string }>) {
        if (s?.NOM_SESSION && /^\d{4}-\d{4}$/.test(s.NOM_SESSION)) anneeSet.add(s.NOM_SESSION);
      }
    }

    // Périodes connues d'Yparéo — dédoublonnées sans tenir compte de la casse ni d'un tiret final
    if (Array.isArray(periodsCache?.data)) {
      const seen = new Set([...periodeSet].map((p) => p.toLowerCase()));
      for (const p of periodsCache.data as Array<{ NOM_PERIODE_EVALUATION?: string }>) {
        const nom = (p?.NOM_PERIODE_EVALUATION || "").replace(/\s*-\s*$/, "").trim();
        if (nom && !seen.has(nom.toLowerCase())) {
          seen.add(nom.toLowerCase());
          periodeSet.add(nom);
        }
      }
    }

    // Les périodes BTS (ex: « BTS Blanc ALT semestre 1 ») ne sont pas proposées dans le filtre
    for (const p of [...periodeSet]) {
      if (/^\s*bts\b/i.test(p)) periodeSet.delete(p);
    }

    const sortFr = (a: string, b: string) => a.localeCompare(b, "fr", { numeric: true });

    // Le ZIP de chaque génération existe-t-il encore ? (les générations antérieures à la mise en place
    // du téléchargement, ou plus anciennes que la durée de conservation, n'ont pas de fichier)
    const availability = await Promise.all(
      generations.map((g) => fileStorage.hasFile(`gen_${g.id}.zip`).catch(() => false))
    );
    const data = generations.map((g, i) => ({ ...g, available: availability[i] }));

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      pageSize,
      hasMore: page * pageSize < total,
      retentionDays: RETENTION_DAYS,
      filters: {
        campuses: [...campusSet].sort(sortFr),
        periodes: [...periodeSet].sort(sortFr),
        annees: [...anneeSet].sort().reverse(),
      },
    });
  } catch (error) {
    console.error("Erreur récupération générations:", error);
    return NextResponse.json({ success: false, error: "Erreur serveur" }, { status: 500 });
  }
}