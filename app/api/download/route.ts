// app/api/download/route.ts
import { blobStorage } from "@/lib/blobStorage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    console.log("blobStorage importé:", blobStorage);
    console.log("getAllFileIds disponible:", typeof blobStorage.getAllFileIds === "function");

    // Get the file identifier from the query parameter
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("id");

    console.log(`Tentative de téléchargement du fichier avec ID: ${fileId}`);

    if (!fileId) {
      console.log("❌ Erreur: Identifiant de fichier manquant");
      return NextResponse.json(
        {
          success: false,
          error: "Identifiant de fichier manquant",
        },
        { status: 400 }
      );
    }

    // Afficher les identifiants disponibles
    const availableFiles = await blobStorage.getAllFileIds();
    console.log(`Fichiers disponibles (${availableFiles.length}):`);
    console.log(availableFiles.join(", "));

    // Check if the file exists
    const fileExists = await blobStorage.hasFile(fileId);
    if (!fileExists) {
      console.log(`❌ Erreur: Fichier non trouvé pour l'ID: ${fileId}`);

      // Vérification supplémentaire: est-ce qu'un fichier similaire existe?
      const similarFiles = availableFiles.filter(
        (filename) =>
          filename.includes(fileId.split("_")[0]) || filename.includes(fileId.split("_")[1] || "")
      );

      if (similarFiles.length > 0) {
        console.log(`Fichiers similaires trouvés: ${similarFiles.join(", ")}`);
      }

      return NextResponse.json(
        {
          success: false,
          error: "Fichier non trouvé",
        },
        { status: 404 }
      );
    }

    // Get the file
    const fileInfo = await blobStorage.getFile(fileId);
    if (!fileInfo || !fileInfo.data) {
      console.log(`❌ Erreur: Impossible de lire le fichier pour l'ID: ${fileId}`);
      console.log("fileInfo:", fileInfo); // Log détaillé de fileInfo
      return NextResponse.json(
        {
          success: false,
          error: "Erreur lors de la récupération du fichier",
          details: "Le fichier existe mais le contenu est inaccessible",
        },
        { status: 500 }
      );
    }

    console.log(
      `✅ Fichier trouvé, taille: ${fileInfo.data.length} octets, type: ${fileInfo.contentType}`
    );

    // Return the file as a response
    const response = new NextResponse(fileInfo.data);

    // Set appropriate headers
    response.headers.set("Content-Type", fileInfo.contentType);
    response.headers.set("Content-Disposition", `attachment; filename="${fileId}"`);

    // Cache control headers
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    console.log("En-têtes de réponse configurés:", Object.fromEntries(response.headers.entries()));

    return response;
  } catch (error) {
    // Log détaillé de l'erreur
    console.error("❌ Erreur lors du téléchargement du fichier:", error);
    console.error("Type d'erreur:", typeof error);
    console.error("Stack trace:", (error as Error).stack);

    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors du téléchargement du fichier",
        details: (error as Error).message,
        stack: (error as Error).stack,
      },
      { status: 500 }
    );
  }
}
