
import { fileStorage } from "@/lib/storage/fileStorage";
import { prisma } from "@/lib/db/client";
import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

// Nom de fichier proposé au téléchargement : bulletins_<groupe>_<période>.zip (caractères sûrs uniquement)
function downloadName(groupe: string, periode: string) {
  const clean = (s: string) => s.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
  return `bulletins_${clean(groupe)}_${clean(periode)}.zip`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const fileId = searchParams.get("id");

    if (!fileId) {
      return new NextResponse("Paramètre 'id' manquant", { status: 400 });
    }

    // 🔒 Anti path-traversal : uniquement gen_<id>.zip (historique) ou tmp_<hex>.zip (sans historique)
    // — jamais de "/", ".." ni "\"
    if (!/^(gen|tmp)_[A-Za-z0-9]+\.zip$/.test(fileId)) {
      return new NextResponse("Identifiant de fichier invalide", { status: 400 });
    }

    let filename = fileId;

    if (fileId.startsWith("gen_")) {
      // 🔒 Un ZIP d'historique n'est téléchargeable que par la personne qui l'a généré
      const session = await getServerSession(authOptions);
      if (!session?.user?.email) {
        return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
      }
      const generationId = fileId.slice("gen_".length, -".zip".length);
      const generation = await prisma.generation.findFirst({
        where: { id: generationId, user: { email: session.user.email } },
        select: { groupe: true, periode: true },
      });
      if (!generation) {
        return NextResponse.json(
          { success: false, error: "Fichier introuvable ou déjà supprimé" },
          { status: 404 }
        );
      }
      filename = downloadName(generation.groupe, generation.periode);
    }
    // tmp_ : nom aléatoire non devinable (généré uniquement si l'historique était indisponible)

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

    // Les fichiers sont supprimés automatiquement par cleanupOldFiles() de fileStorage.ts
    // après la durée de conservation (cf. lib/storage/retention.ts).
    // L'utilisateur peut donc retélécharger tant que le fichier existe.

    const response = new NextResponse(new Uint8Array(fileInfo.data));
    response.headers.set("Content-Type", fileInfo.contentType);
    response.headers.set("Content-Disposition", `attachment; filename="${filename}"`);
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
