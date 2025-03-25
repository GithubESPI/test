// lib/fileStorage.ts
import { del, head, list, put } from "@vercel/blob";

export const fileStorage = {
  // Stocke un fichier dans Vercel Blob
  async storeFile(
    id: string,
    data: Buffer,
    contentType: string = "application/zip"
  ): Promise<void> {
    await put(`temp/${id}`, data, { contentType, access: "public" });
    console.log(`✅ Fichier stocké sur Vercel Blob: temp/${id}`);
  },

  // Vérifie si le fichier existe
  async hasFile(id: string): Promise<boolean> {
    try {
      await head(`temp/${id}`, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return true;
    } catch {
      return false;
    }
  },

  // Récupère les infos du fichier
  async getFile(id: string): Promise<{ url: string; contentType: string } | null> {
    try {
      const file = await head(`temp/${id}`, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return {
        url: file.url,
        contentType: file.contentType || "application/octet-stream",
      };
    } catch {
      return null;
    }
  },

  // Supprime un fichier
  async deleteFile(id: string): Promise<boolean> {
    try {
      await del(`temp/${id}`, { token: process.env.BLOB_READ_WRITE_TOKEN });
      return true;
    } catch (error) {
      console.error("Erreur de suppression:", error);
      return false;
    }
  },

  // Liste tous les fichiers
  async getAllFileIds(): Promise<string[]> {
    try {
      const blobs = await list({ prefix: "temp/", token: process.env.BLOB_READ_WRITE_TOKEN });
      return blobs.blobs.map((blob) => blob.pathname.replace("temp/", ""));
    } catch (error) {
      console.error("Erreur lors de la récupération de la liste:", error);
      return [];
    }
  },

  // Supprime les fichiers trop anciens
  async cleanupOldFiles(maxAgeMinutes: number = 60): Promise<void> {
    const now = Date.now();
    const files = await this.getAllFileIds();
    let cleanedCount = 0;

    for (const id of files) {
      try {
        const meta = await head(`temp/${id}`, { token: process.env.BLOB_READ_WRITE_TOKEN });
        const uploadedAt = new Date(meta.uploadedAt).getTime();
        if (now - uploadedAt > maxAgeMinutes * 60 * 1000) {
          await this.deleteFile(id);
          cleanedCount++;
        }
      } catch (err) {
        console.error(`Erreur lors du nettoyage du fichier ${id}:`, err);
      }
    }

    if (cleanedCount > 0) {
      console.log(`${cleanedCount} fichiers nettoyés`);
    }
  },
};

// Nettoyage automatique toutes les heures
setInterval(() => {
  fileStorage.cleanupOldFiles().catch(console.error);
}, 60 * 60 * 1000);
