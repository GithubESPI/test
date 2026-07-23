import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { NextResponse } from "next/server";
import { withYmageCache } from "@/lib/ymag/cache";

// On gère le cache nous-mêmes (YmageCache) → cache route Next désactivé
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const token = process.env.TOKEN_REQUETEUR!;
    const url = process.env.URL_REQUETEUR!;

    if (!token || !url) {
      throw new Error("Variables d'environnement TOKEN_REQUETEUR ou URL_REQUETEUR manquantes");
    }

    // 🎯 Si group + session fournis → seules les périodes du RÉFÉRENTIEL de ce groupe
    // pour cette année académique. Évite les doublons de noms ("ALT Semestre 2" existe
    // pour plusieurs années) qui menaient à des bulletins vides si on choisissait le mauvais.
    const { searchParams } = new URL(request.url);
    const group = (searchParams.get("group") || "").replace(/\D/g, "");
    const session = (searchParams.get("session") || "").replace(/\D/g, "");
    const scoped = !!(group && session);

    const sql = scoped
      ? `SELECT DISTINCT pe.CODE_PERIODE_EVALUATION, pe.NOM_PERIODE_EVALUATION, pe.DATE_DEB, pe.DATE_FIN
         FROM GROUPE g
         INNER JOIN REFERENTIEL r ON g.CODE_FORMATION = r.CODE_FORMATION
         INNER JOIN PERIODE_EVALUATION pe ON r.CODE_PERIODE_EVALUATION = pe.CODE_PERIODE_EVALUATION
         WHERE g.CODE_GROUPE = ${group} AND r.CODE_SESSION = ${session}
           AND (r.CODE_ANNEE = g.NUMERO_ANNEE OR (r.CODE_ANNEE = 4 AND g.NUMERO_ANNEE = 3))
         ORDER BY pe.NOM_PERIODE_EVALUATION`
      : "SELECT * FROM PERIODE_EVALUATION ORDER BY NOM_PERIODE_EVALUATION";

    const { data: periodsArray, fromCache } = await withYmageCache(
      scoped ? `periods_${session}_${group}` : "periods",
      30 * 24 * 3600, // 30 jours — les périodes changent au maximum une fois par semestre
      async () => {
        const responseData = await fetchWithRetry(url, {
          method: "POST",
          headers: {
            "X-Auth-Token": token,
            "Content-Type": "application/json",
            Accept: "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          body: JSON.stringify({ sql }),
        });
        return Array.isArray(responseData)
          ? responseData
          : Object.values(responseData as object);
      }
    );

    return NextResponse.json(
      {
        success: true,
        data: periodsArray,
        ...(fromCache && {
          fromCache: true,
          warning: "Ymag temporairement inaccessible — données depuis le cache",
        }),
      },
      {
        headers: {
          "Cache-Control": fromCache
            ? "no-store"
            : "public, s-maxage=600, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    console.error("Erreur lors de la récupération des périodes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération des périodes d'évaluation",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
