import { NextResponse } from "next/server";

export async function GET() {
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement manquantes");
    }

    const url = `${baseUrl}/r/v1/formation-longue/apprenants?codesPeriode=4`;

    console.log("Calling API with URL:", url);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": apiToken,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    console.log("Response status:", response.status);
    // Si la réponse n'est pas JSON, essayez de lire le texte
    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error response:", errorText);
      throw new Error(`Erreur HTTP: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur détaillée:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données", details: (error as Error).message },
      { status: 500 }
    );
  }
}
