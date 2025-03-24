import { NextResponse } from "next/server";

export async function GET() {
  console.log("Début de la requête API students");
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    console.log(`Base URL: ${baseUrl ? "configurée" : "manquante"}`);
    console.log(`API Token: ${apiToken ? "configuré" : "manquant"}`);

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement manquantes");
    }

    const url = `${baseUrl}/r/v1/formation-longue/apprenants?codesPeriode=4`;
    console.log(`URL de l'API: ${url}`);

    // Augmenter le timeout à 15 secondes
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log("Timeout déclenché après 15 secondes");
      controller.abort();
    }, 15000);

    console.log("Envoi de la requête...");
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": apiToken,
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 3600 },
    });

    clearTimeout(timeoutId);
    console.log(`Réponse reçue avec statut: ${response.status}`);

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log("Données reçues avec succès");
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur détaillée:", error);

    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Délai d'attente dépassé lors de la connexion à l'API externe (15s)" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Erreur lors de la récupération des données", details: (error as Error).message },
      { status: 500 }
    );
  }
}
