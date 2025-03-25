import { fileStorage } from "@/lib/fileStorage";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("id");

    console.log(`📥 Téléchargement demandé pour: ${fileId}`);

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: "Identifiant de fichier manquant" },
        { status: 400 }
      );
    }

    // 🔥 DEBUG — Liste des fichiers dispo
    const availableFiles = await fileStorage.getAllFileIds();
    console.log(`📁 Fichiers disponibles sur Blob (${availableFiles.length}):`);
    console.log(availableFiles.join(", "));

    const fileExists = await fileStorage.hasFile(fileId);
    if (!fileExists) {
      console.log(`❌ Fichier non trouvé: ${fileId}`);
      return NextResponse.json({ success: false, error: "Fichier non trouvé" }, { status: 404 });
    }

    const fileInfo = await fileStorage.getFile(fileId);
    if (!fileInfo) {
      console.log(`❌ Impossible de récupérer les infos du fichier`);
      return NextResponse.json(
        { success: false, error: "Erreur de récupération" },
        { status: 500 }
      );
    }

    const blobRes = await fetch(fileInfo.url);
    if (!blobRes.ok) {
      throw new Error(`Erreur lors du fetch depuis Vercel Blob`);
    }

    const arrayBuffer = await blobRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    console.log(`✅ Fichier téléchargé depuis Blob, taille: ${buffer.length} octets`);

    const response = new NextResponse(buffer);
    response.headers.set("Content-Type", fileInfo.contentType);
    response.headers.set("Content-Disposition", `attachment; filename="${fileId}"`);
    response.headers.set("Cache-Control", "no-cache");

    return response;
  } catch (error) {
    console.error("❌ Erreur route download:", error);
    return NextResponse.json(
      { success: false, error: "Erreur interne", details: (error as Error).message },
      { status: 500 }
    );
  }
}
