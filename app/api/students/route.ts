import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { NextResponse } from "next/server";

// ✅ Cache 5 minutes — évite les 19s à chaque requête
export const revalidate = 300;

export async function GET() {
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement YPAERO_BASE_URL ou YPAERO_API_TOKEN manquantes");
    }

    const url = `${baseUrl}/r/v1/formation-longue/apprenants?codesPeriode=5`;

    const data = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": apiToken,
        Accept: "application/json",
      },
      // ✅ cache: "no-store" retiré
    });

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });
  } catch (error) {
    console.error("Erreur récupération étudiants:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données", details: (error as Error).message },
      { status: 500 }
    );
  }
}