import { NextResponse } from "next/server";

// Fonction auxiliaire avec retry et timeout
async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 3) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 secondes timeout

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Pour traiter la réponse de manière plus robuste
      const responseText = await response.text();
      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error("Erreur de parsing JSON:", parseError);
        console.error("Réponse brute:", responseText);
        throw new Error(`Erreur de parsing JSON: ${responseText.substring(0, 200)}...`);
      }
    } catch (error) {
      console.error(`Tentative ${i + 1}/${maxRetries} échouée:`, error);
      lastError = error;
      // Attendre avant de réessayer (backoff exponentiel)
      if (i < maxRetries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}

export async function GET() {
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement manquantes");
    }

    const url = `${baseUrl}/r/v1/formation-longue/groupes?codesPeriode=4`;
    console.log("URL de l'API:", url);

    const data = await fetchWithRetry(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": apiToken,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("Erreur:", error);
    return NextResponse.json(
      { error: "Erreur lors de la récupération des données", details: (error as Error).message },
      { status: 500 }
    );
  }
}
