import { NextResponse } from "next/server";

const token =
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE3MjA0NzYwMDAsImNsdCI6IjNFREI0QUU3LTlGNDEtNDM4QS1CRDE1LTQ1Rjk3MEVEQ0VCOSJ9.q8i-pDiwdf4Zlja-bd9keZTD0IIeJOrKDl8PGai9mPE";
const url = "https://groupe-espi.ymag.cloud/index.php/r/v1/sql/requeteur";

// Fonction auxiliaire avec retry et timeout
// Amélioration de la fonction fetchWithRetry
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

      // Vérifier si la réponse est vide ou invalide
      if (!responseText || responseText.trim() === "") {
        //return [];
        throw new Error("La réponse de l'API est vide");
      }

      try {
        return JSON.parse(responseText);
      } catch (parseError) {
        console.error("Erreur de parsing JSON:", parseError);
        console.error("Réponse brute:", responseText);
        throw new Error(`Erreur de parsing JSON: ${responseText}`);
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
    const responseData = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sql: "SELECT * FROM PERIODE_EVALUATION ORDER BY NOM_PERIODE_EVALUATION",
      }),
    });

    // S'assurer que les données sont un tableau
    const periodsArray = Array.isArray(responseData) ? responseData : Object.values(responseData);

    return NextResponse.json({
      success: true,
      data: periodsArray,
    });
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
