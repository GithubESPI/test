import { fileStorage } from "@/lib/fileStorage";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    const tempDir = path.join(process.cwd(), "temp");
    console.log(`Dossier temp: ${tempDir}`);
    console.log(`Dossier temp existe: ${fs.existsSync(tempDir)}`);

    if (fs.existsSync(tempDir)) {
      const files = fs.readdirSync(tempDir);
      console.log(`Contenu du dossier temp (${files.length} fichiers):`);
      console.log(files.slice(0, 20).join(", ") + (files.length > 20 ? "..." : ""));
    }

    console.log("fileStorage importé:", fileStorage);
    console.log("getAllFileIds disponible:", typeof fileStorage.getAllFileIds === "function");

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

    // ✅ Utiliser await ici
    const availableFiles = await fileStorage.getAllFileIds();
    console.log(`Fichiers disponibles sur disque (${availableFiles.length}):`);
    console.log(availableFiles.join(", "));

    const exactFilePath = path.join(tempDir, fileId);
    console.log(`Chemin complet du fichier recherché: ${exactFilePath}`);
    console.log(`Le fichier existe directement sur le disque: ${fs.existsSync(exactFilePath)}`);

    // ✅ Utiliser await ici aussi si hasFile est async
    const fileExists = await fileStorage.hasFile(fileId);
    if (!fileExists) {
      console.log(`❌ Erreur: Fichier non trouvé pour l'ID: ${fileId}`);

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

    // ✅ Utiliser await ici aussi
    const fileInfo = await fileStorage.getFile(fileId);
    if (!fileInfo) {
      console.log(`❌ Erreur: Impossible de lire le fichier pour l'ID: ${fileId}`);
      return NextResponse.json(
        {
          success: false,
          error: "Erreur lors de la récupération du fichier",
        },
        { status: 500 }
      );
    }

    // Télécharger les données depuis l'URL retournée par Vercel Blob
    const blobResponse = await fetch(fileInfo.url);
    const fileBuffer = await blobResponse.arrayBuffer();

    console.log(`✅ Fichier trouvé, taille: ${fileBuffer.byteLength} octets`);

    const response = new NextResponse(Buffer.from(fileBuffer));

    response.headers.set("Content-Type", fileInfo.contentType);
    response.headers.set("Content-Disposition", `attachment; filename="${fileId}"`);
    response.headers.set("Cache-Control", "no-cache, no-store, must-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");

    console.log("En-têtes de réponse configurés:", Object.fromEntries(response.headers.entries()));

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
