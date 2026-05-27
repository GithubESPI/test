
import { fileStorage } from "@/lib/storage/fileStorage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("id");

    if (!fileId) {
      return new NextResponse("Paramètre 'id' manquant", { status: 400 });
    }

    if (!await fileStorage.hasFile(fileId)) {
      return NextResponse.json(
        { success: false, error: "Fichier introuvable ou déjà supprimé" },
        { status: 404 }
      );
    }

    const fileInfo = await fileStorage.getFile(fileId);
    if (!fileInfo) {
      return NextResponse.json(
        { success: false, error: "Erreur lors de la récupération du fichier" },
        { status: 500 }
      );
    }

    // ✅ Plus de deleteFile() ici — le cleanupOldFiles() de fileStorage.ts
    // supprime automatiquement les fichiers après 60 min.
    // L'utilisateur peut réessayer le téléchargement si la connexion coupe.

    const response = new NextResponse(new Uint8Array(fileInfo.data));
    response.headers.set("Content-Type", fileInfo.contentType);
    response.headers.set("Content-Disposition", `attachment; filename="${fileId}"`);
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    return response;

  } catch (error) {
    console.error("❌ Erreur lors du téléchargement du fichier:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors du téléchargement du fichier",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}