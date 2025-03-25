// lib/fileStorage.ts
import { del, head, list, put } from "@vercel/blob";

export const fileStorage = {
  // Stocker un fichier sur Vercel Blob
  async storeFile(
    id: string,
    data: Buffer,
    contentType: string = "application/zip"
  ): Promise<void> {
    await put(`temp/${id}`, data, { contentType, access: "public" });
    console.log(`Fichier stocké sur Vercel Blob: temp/${id}, taille: ${data.length} octets`);
  },

  // Vérifier si un fichier existe
  async hasFile(id: string): Promise<boolean> {
    try {
      await head(`temp/${id}`);
      return true;
    } catch {
      return false;
    }
  },

  // Lire un fichier
  async getFile(id: string): Promise<{ url: string; contentType: string } | null> {
    try {
      const file = await head(`temp/${id}`);
      return {
        url: file.url,
        contentType: file.contentType || "application/zip",
      };
    } catch {
      return null;
    }
  },

  // Supprimer un fichier
  async deleteFile(id: string): Promise<boolean> {
    try {
      await del(`temp/${id}`);
      return true;
    } catch (error) {
      console.error(`Erreur lors de la suppression du fichier ${id}:`, error);
      return false;
    }
  },

  // Obtenir la liste des fichiers disponibles
  async getAllFileIds(): Promise<string[]> {
    try {
      const blobs = await list({ prefix: "temp/" });
      return blobs.blobs.map((blob) => blob.pathname.replace("temp/", ""));
    } catch (error) {
      console.error("Erreur lors de la récupération des fichiers:", error);
      return [];
    }
  },

  // Nettoyer les fichiers anciens (plus vieux que x minutes)
  async cleanupOldFiles(maxAgeMinutes: number = 60): Promise<void> {
    const files = await this.getAllFileIds();
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of files) {
      try {
        const fileInfo = await head(`temp/${file}`);
        const age = now - new Date(fileInfo.uploadedAt).getTime();

        if (age > maxAgeMinutes * 60 * 1000) {
          await this.deleteFile(file);
          cleanedCount++;
        }
      } catch (error) {
        console.error(`Erreur lors du traitement de ${file}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`${cleanedCount} fichiers temporaires nettoyés de Vercel Blob.`);
    }
  },
};

// Nettoyage automatique (toutes les heures)
setInterval(() => {
  fileStorage
    .cleanupOldFiles()
    .catch((err) => console.error("Erreur lors du nettoyage des fichiers Blob:", err));
}, 60 * 60 * 1000);
