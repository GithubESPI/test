// app/api/pdf-direct/route.ts
import { NextRequest, NextResponse } from "next/server";
// Autres imports nécessaires...

export async function POST(request: NextRequest) {
  try {
    // Extraire les données de formulaire
    const formData = await request.formData();
    const groupName = formData.get("groupName")?.toString() || "Groupe";
    const periodeEvaluation = formData.get("periodeEvaluation")?.toString() || "Période";

    // Récupérer les données depuis une session serveur ou une base de données temporaire
    // (vous devrez implémenter cette partie en fonction de votre backend)
    // Ceci est juste un exemple
    const sessionData = await getSessionData(groupName);

    if (!sessionData) {
      throw new Error("Données non disponibles");
    }

    // Générer les PDFs et le ZIP comme dans votre code existant
    // ...

    // Retourner directement le ZIP comme réponse
    const response = new NextResponse(zipBuffer);
    response.headers.set("Content-Type", "application/zip");
    response.headers.set(
      "Content-Disposition",
      `attachment; filename="bulletins_${sanitizedGroupName}_${sanitizedPeriod}.zip"`
    );

    return response;
  } catch (error) {
    console.error("Erreur lors de la génération des PDFs:", error);
    // Rediriger vers une page d'erreur si possible
    return NextResponse.redirect(
      "/error-page?message=" + encodeURIComponent("Erreur lors de la génération des PDFs")
    );
  }
}
