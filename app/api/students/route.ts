import { NextResponse } from "next/server";

// Cache 5 minutes — les campus changent très rarement
export const revalidate = 300;

export async function GET() {
  try {
    const token = process.env.TOKEN_REQUETEUR!;
    const url = process.env.URL_REQUETEUR!;

    if (!token || !url) {
      throw new Error("Variables TOKEN_REQUETEUR ou URL_REQUETEUR manquantes");
    }

    // ✅ Requête ultra-légère : uniquement CODE_SITE + NOM_SITE
    // Avant : /formation-longue/apprenants chargeait tous les apprenants (~36 Mo)
    //         juste pour extraire les codeSite uniques
    // Après : 2 colonnes, quelques dizaines de lignes (~2 Ko)
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
    const sitesArray = Array.isArray(data) ? data : Object.values(data);

    return NextResponse.json(sitesArray, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
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