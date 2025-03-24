import { NextResponse } from "next/server";
import NodeCache from "node-cache";

// Cache avec une durée de vie de 30 minutes
const cache = new NodeCache({ stdTTL: 1800 });

// Fonction auxiliaire avec retry, timeout et gestion des réponses partielles
async function fetchWithSafetyNet(url: string, options: RequestInit, maxRetries = 5) {
  const cacheKey = `${url}_${JSON.stringify(options.headers)}`;

  // Vérifier le cache d'abord
  const cachedData = cache.get(cacheKey);
  if (cachedData) {
    console.log("✅ Données récupérées depuis le cache");
    return cachedData;
  }

  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes timeout (très long)

      console.log(`🔄 Tentative ${i + 1}/${maxRetries} pour ${url}`);

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
        const data = JSON.parse(responseText);

        // Mettre en cache le résultat réussi
        cache.set(cacheKey, data);

        return data;
      } catch (parseError) {
        console.error("Erreur de parsing JSON:", parseError);

        // Tenter de réparer un JSON corrompu si possible
        if (responseText.endsWith('"}') || responseText.endsWith("]}")) {
          console.log("Le JSON semble complet, tentative de nettoyage...");
          try {
            // Trouver la dernière accolade ou crochet valide
            const lastValidJson = findLastValidJson(responseText);
            if (lastValidJson) {
              const data = JSON.parse(lastValidJson);
              cache.set(cacheKey, data);
              return data;
            }
          } catch (error) {
            console.error("Échec de la réparation du JSON:", error);
          }
        }

        throw new Error(`Erreur de parsing JSON: la réponse est corrompue`);
      }
    } catch (error) {
      console.error(`Tentative ${i + 1}/${maxRetries} échouée:`, error);
      lastError = error;

      // Attendre plus longtemps entre les essais
      if (i < maxRetries - 1) {
        const waitTime = 2000 * Math.pow(2, i); // Attente exponentielle plus longue
        console.log(`Attente de ${waitTime}ms avant de réessayer...`);
        await new Promise((r) => setTimeout(r, waitTime));
      }
    }
  }

  throw lastError;
}

function findLastValidJson(text: string): string | null {
  // Si le texte est trop court, il ne peut pas contenir de JSON valide
  if (!text || text.length < 2) {
    return null;
  }

  // Essayer d'abord le texte complet
  try {
    JSON.parse(text);
    return text; // Si ça marche, pas besoin de chercher plus loin
  } catch {
    // Continuer avec la recherche
  }

  // Explorer différentes stratégies pour récupérer du JSON valide

  // 1. Stratégie - Tronquer à l'accolade ou crochet fermant le plus proche de la fin
  let truncated = text;

  // Chercher la dernière occurrence de "}]" qui indiquerait la fin d'un tableau d'objets
  const lastArrayEnd = text.lastIndexOf("}]");
  if (lastArrayEnd > 0) {
    try {
      truncated = text.substring(0, lastArrayEnd + 2);
      JSON.parse(truncated);
      return truncated;
    } catch {
      // Pas valide, essayer une autre stratégie
    }
  }

  // 2. Chercher la dernière accolade fermante (fin d'un objet)
  const lastObjectEnd = text.lastIndexOf("}");
  if (lastObjectEnd > 0) {
    try {
      truncated = text.substring(0, lastObjectEnd + 1);
      JSON.parse(truncated);
      return truncated;
    } catch {
      // Pas valide, essayer une autre stratégie
    }
  }

  // 3. Chercher le dernier crochet fermant (fin d'un tableau)
  const lastArrayBracketEnd = text.lastIndexOf("]");
  if (lastArrayBracketEnd > 0) {
    try {
      truncated = text.substring(0, lastArrayBracketEnd + 1);
      JSON.parse(truncated);
      return truncated;
    } catch {
      // Pas valide, essayer une autre stratégie
    }
  }

  // 4. Approche plus agressive - Chercher un objet valide dans le texte
  // Pour chaque accolade fermante, tenter de parser ce qui précède
  const closingBraces = [...text.matchAll(/\}/g)].map((match) => match.index);

  for (let i = closingBraces.length - 1; i >= 0; i--) {
    const index = closingBraces[i];
    if (index !== undefined) {
      const start = text.lastIndexOf("{", index);
      if (start >= 0) {
        try {
          const potentialJson = text.substring(start, index + 1);
          JSON.parse(potentialJson);
          return potentialJson;
        } catch {
          // Continuer à chercher
        }
      }
    }
  }

  // 5. Dernier recours - chercher n'importe quel tableau valide
  const closingBrackets = [...text.matchAll(/\]/g)].map((match) => match.index);

  for (let i = closingBrackets.length - 1; i >= 0; i--) {
    const index = closingBrackets[i];
    if (index !== undefined) {
      const start = text.lastIndexOf("[", index);
      if (start >= 0) {
        try {
          const potentialJson = text.substring(start, index + 1);
          JSON.parse(potentialJson);
          return potentialJson;
        } catch {
          // Continuer à chercher
        }
      }
    }
  }

  // Aucune stratégie n'a fonctionné
  return null;
}

export async function GET() {
  try {
    const baseUrl = process.env.YPAERO_BASE_URL;
    const apiToken = process.env.YPAERO_API_TOKEN;

    if (!baseUrl || !apiToken) {
      throw new Error("Variables d'environnement manquantes");
    }

    const url = `${baseUrl}/r/v1/formation-longue/apprenants?codesPeriode=4`;
    console.log("🔍 URL de l'API:", url);

    const data = await fetchWithSafetyNet(url, {
      method: "GET",
      headers: {
        "X-Auth-Token": apiToken,
        Accept: "application/json",
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("❌ Erreur:", error);

    // En cas d'échec total, retourner un tableau vide plutôt qu'une erreur
    // pour permettre au frontend de continuer à fonctionner
    return NextResponse.json(
      {
        success: false,
        data: [],
        error: "Erreur lors de la récupération des données",
        details: (error as Error).message,
      },
      { status: 200 } // Retourner 200 pour éviter les erreurs côté client
    );
  }
}
