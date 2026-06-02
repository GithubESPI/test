import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { NextResponse } from "next/server";
import { withYmageCache } from "@/lib/ymag/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement YPAERO_BASE_URL ou YPAERO_API_TOKEN manquantes");
    }

    const { data, fromCache } = await withYmageCache(
      "groups",
      7 * 24 * 3600, // 7 jours — les groupes sont stables au sein d'un semestre
      async () => {
        const url = `${baseUrl}/r/v1/formation-longue/groupes?codesPeriode=5`;
        return await fetchWithRetry(url, {
          method: "GET",
          headers: {
            "X-Auth-Token": apiToken,
            Accept: "application/json",
          },
        });
      }
    );

    const headers: Record<string, string> = {
      "Cache-Control": fromCache
        ? "no-store"
        : "public, s-maxage=300, stale-while-revalidate=60",
    };
    if (fromCache) headers["X-Cache-Fallback"] = "true";

    return NextResponse.json(data, { headers });
  } catch (error) {
    console.error("Erreur récupération groupes:", error);
    return NextResponse.json(
      {
        error: "Erreur lors de la récupération des données",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}
