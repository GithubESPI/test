export async function fetchWithRetry(url: string, options: RequestInit, maxRetries = 2) {
  let lastError;

  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      // ✅ 8s max par tentative, pas 60s
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseText = await response.text();

      if (!responseText || responseText.trim() === "") {
        throw new Error("La réponse de l'API est vide");
      }

      try {
        return JSON.parse(responseText);
      } catch {
        throw new Error(`Erreur de parsing JSON: ${responseText.substring(0, 200)}`);
      }
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        // ✅ Délai fixe court, pas exponentiel
        await new Promise((r) => setTimeout(r, 500));
      }
    }
  }

  throw lastError;
}