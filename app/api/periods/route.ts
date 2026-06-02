import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { NextResponse } from "next/server";
import { withYmageCache } from "@/lib/ymag/cache";

// On gère le cache nous-mêmes (YmageCache) → cache route Next désactivé
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = process.env.TOKEN_REQUETEUR!;
    const url = process.env.URL_REQUETEUR!;

    if (!token || !url) {
      throw new Error("Variables d'environnement TOKEN_REQUETEUR ou URL_REQUETEUR manquantes");
    }

    const { data: periodsArray, fromCache } = await withYmageCache(
      "periods",
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
          body: JSON.stringify({
            sql: "SELECT * FROM PERIODE_EVALUATION ORDER BY NOM_PERIODE_EVALUATION",
          }),
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
