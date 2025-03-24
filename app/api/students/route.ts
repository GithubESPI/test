import { NextResponse } from "next/server";

// Cette fonction utilise ISR pour mettre en cache les données tout en les revalidant périodiquement
export async function GET() {
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement manquantes");
    }

    const url = `${baseUrl}/r/v1/formation-longue/apprenants?codesPeriode=4`;

    // Créer un controller pour pouvoir ajouter un timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": apiToken,
        Accept: "application/json",
      },
      signal: controller.signal,
      next: { revalidate: 3600 }, // Revalider toutes les heures (3600 secondes)
    });

    // Nettoyage du timeout
    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Erreur HTTP: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur:", error);

    // Message d'erreur plus spécifique si c'est un timeout
    if (error instanceof DOMException && error.name === "AbortError") {
      return NextResponse.json(
        { error: "Délai d'attente dépassé lors de la connexion à l'API externe" },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { error: "Erreur lors de la récupération des données", details: (error as Error).message },
      { status: 500 }
    );
  }
}
