import { NextResponse } from "next/server";
import { withYmageCache } from "@/lib/ymag/cache";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const token = process.env.TOKEN_REQUETEUR!;
    const url = process.env.URL_REQUETEUR!;

    if (!token || !url) {
      throw new Error("Variables TOKEN_REQUETEUR ou URL_REQUETEUR manquantes");
    }

    const { data: sitesArray, fromCache } = await withYmageCache(
      "sites",
      30 * 24 * 3600, // 30 jours — les campus changent très rarement
      async () => {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "X-Auth-Token": token,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            sql: "SELECT DISTINCT CODE_SITE, NOM_SITE FROM SITE ORDER BY NOM_SITE",
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data : Object.values(data as object);
      }
    );

    return NextResponse.json(sitesArray, {
      headers: {
        "Cache-Control": fromCache
          ? "no-store"
          : "public, s-maxage=300, stale-while-revalidate=60",
        ...(fromCache && { "X-Cache-Fallback": "true" }),
      },
    });
  } catch (error) {
    console.error("Erreur récupération campus:", error);
    return NextResponse.json(
      { error: "Erreur récupération campus", details: (error as Error).message },
      { status: 500 }
    );
  }
}
