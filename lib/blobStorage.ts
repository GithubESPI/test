// lib/blobStorage.ts
import { del, head, list, put } from "@vercel/blob";
import fs from "fs";
import path from "path";

interface FileInfo {
  data: Buffer;
  contentType: string;
}

class Storage {
  private isProduction: boolean;
  private tempDir: string;
  private files: Map<string, FileInfo>;

  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
    this.tempDir = path.join(process.cwd(), "temp");
    this.files = new Map();

    // Créer le dossier temporaire en mode développement
    if (!this.isProduction && !fs.existsSync(this.tempDir)) {
      try {
        fs.mkdirSync(this.tempDir, { recursive: true });
        console.log(`📁 Dossier temporaire créé: ${this.tempDir}`);
      } catch (error) {
        console.error(`❌ Erreur lors de la création du dossier temporaire: ${error}`);
      }
    }
  }

  /**
   * Stocke un fichier dans le système de stockage
   */
  async storeFile(id: string, data: Buffer, contentType: string): Promise<string> {
    if (this.isProduction) {
      // En production: utiliser Vercel Blob
      try {
        const blob = await put(`files/${id}`, data, {
          contentType,
          access: "public",
        });
        console.log(`✅ Fichier stocké dans Vercel Blob: ${blob.url}`);
        return blob.url;
      } catch (error) {
        console.error(`❌ Erreur lors du stockage dans Vercel Blob: ${error}`);
        throw error;
      }
    } else {
      // En développement: stocker en mémoire et sur le disque
      try {
        this.files.set(id, { data, contentType });

        // Stocker également sur le disque pour persistance entre redémarrages
        const filePath = path.join(this.tempDir, id);
        fs.writeFileSync(filePath, data);

        console.log(`✅ Fichier stocké localement: ${filePath}`);
        return `/api/download?id=${id}`;
      } catch (error) {
        console.error(`❌ Erreur lors du stockage local: ${error}`);
        throw error;
      }
    }
  }

  /**
   * Récupère un fichier du système de stockage
   */
  async getFile(id: string): Promise<FileInfo | null> {
    if (this.isProduction) {
      // En production: récupérer depuis Vercel Blob
      try {
        const blob = await head(`files/${id}`);
        if (!blob) {
          console.log(`❌ Fichier non trouvé dans Vercel Blob: files/${id}`);
          return null;
        }

        // Récupérer le contenu du blob
        const response = await fetch(blob.url);
        const data = Buffer.from(await response.arrayBuffer());

        return {
          data,
          contentType: blob.contentType || "application/octet-stream",
        };
      } catch (error) {
        console.error(`❌ Erreur lors de la récupération depuis Vercel Blob: ${error}`);
        return null;
      }
    } else {
      // En développement: récupérer depuis la mémoire ou le disque
      try {
        // Vérifier d'abord en mémoire
        if (this.files.has(id)) {
          return this.files.get(id) || null;
        }

        // Sinon, essayer de lire depuis le disque
        const filePath = path.join(this.tempDir, id);
        if (fs.existsSync(filePath)) {
          const data = fs.readFileSync(filePath);
          // Déterminer le type de contenu en fonction de l'extension
          const contentType = id.endsWith(".zip")
            ? "application/zip"
            : id.endsWith(".pdf")
            ? "application/pdf"
            : "application/octet-stream";

          // Mettre en cache en mémoire
          const fileInfo = { data, contentType };
          this.files.set(id, fileInfo);

          return fileInfo;
        }

        console.log(`❌ Fichier non trouvé localement: ${id}`);
        return null;
      } catch (error) {
        console.error(`❌ Erreur lors de la récupération locale: ${error}`);
        return null;
      }
    }
  }

  /**
   * Vérifie si un fichier existe dans le système de stockage
   */
  async hasFile(id: string): Promise<boolean> {
    if (this.isProduction) {
      // En production: vérifier dans Vercel Blob
      try {
        const blob = await head(`files/${id}`);
        return blob !== null;
      } catch (error) {
        console.error(`❌ Erreur lors de la vérification dans Vercel Blob: ${error}`);
        return false;
      }
    } else {
      // En développement: vérifier en mémoire ou sur le disque
      if (this.files.has(id)) {
        return true;
      }

      const filePath = path.join(this.tempDir, id);
      return fs.existsSync(filePath);
    }
  }

  /**
   * Obtient tous les identifiants de fichiers stockés
   */
  async getAllFileIds(): Promise<string[]> {
    if (this.isProduction) {
      // En production: lister les fichiers dans Vercel Blob
      try {
        const { blobs } = await list({ prefix: "files/" });
        return blobs.map((blob) => blob.pathname.replace("files/", ""));
      } catch (error) {
        console.error(`❌ Erreur lors de la liste des fichiers dans Vercel Blob: ${error}`);
        return [];
      }
    } else {
      // En développement: lister les fichiers du dossier temporaire
      try {
        if (fs.existsSync(this.tempDir)) {
          return fs.readdirSync(this.tempDir);
        }
        return Array.from(this.files.keys());
      } catch (error) {
        console.error(`❌ Erreur lors de la liste des fichiers locaux: ${error}`);
        return Array.from(this.files.keys());
      }
    }
  }

  /**
   * Supprime un fichier du système de stockage
   */
  async deleteFile(id: string): Promise<boolean> {
    if (this.isProduction) {
      // En production: supprimer de Vercel Blob
      try {
        await del(`files/${id}`);
        return true;
      } catch (error) {
        console.error(`❌ Erreur lors de la suppression dans Vercel Blob: ${error}`);
        return false;
      }
    } else {
      // En développement: supprimer de la mémoire et du disque
      this.files.delete(id);

      try {
        const filePath = path.join(this.tempDir, id);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        return true;
      } catch (error) {
        console.error(`❌ Erreur lors de la suppression locale: ${error}`);
        return false;
      }
    }
  }
}

export async function uploadZipToBlob(fileBuffer: Buffer, filename: string): Promise<string> {
  const blob = await put(`files/${filename}`, fileBuffer, {
    access: "public", // le fichier sera téléchargeable depuis le front
    contentType: "application/zip",
  });

  return blob.url; // tu pourras l'utiliser côté front directement
}

export const blobStorage = new Storage();
