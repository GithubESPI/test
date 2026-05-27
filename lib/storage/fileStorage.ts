import {
  BlobServiceClient,
  ContainerClient,
  StorageSharedKeyCredential,
} from "@azure/storage-blob";

// ============================================================
// CLIENT AZURE BLOB — singleton
// ============================================================

const CONTAINER_NAME = "bulletins";
const CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const MAX_AGE_MINUTES = 60;

function getContainerClient(): ContainerClient {
  if (!CONNECTION_STRING) {
    throw new Error("Variable d'environnement AZURE_STORAGE_CONNECTION_STRING manquante");
  }
  const blobServiceClient = BlobServiceClient.fromConnectionString(CONNECTION_STRING);
  return blobServiceClient.getContainerClient(CONTAINER_NAME);
}

// ============================================================
// API fileStorage — même interface qu'avant, mais sur Azure
// ============================================================

export const fileStorage = {
  async storeFile(
    id: string,
    data: Buffer,
    contentType: string = "application/zip"
  ): Promise<void> {
    const container = getContainerClient();
    const blob = container.getBlockBlobClient(id);

    await blob.upload(data, data.length, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata: {
        timestamp: Date.now().toString(),
        contentType,
      },
    });
  },

  async hasFile(id: string): Promise<boolean> {
    try {
      const container = getContainerClient();
      const blob = container.getBlockBlobClient(id);
      await blob.getProperties();
      return true;
    } catch {
      return false;
    }
  },

  async getFile(
    id: string
  ): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const container = getContainerClient();
      const blob = container.getBlockBlobClient(id);
      const props = await blob.getProperties();
      const download = await blob.download();

      const chunks: Buffer[] = [];
      for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }

      return {
        data: Buffer.concat(chunks),
        contentType:
          props.contentType || "application/zip",
      };
    } catch {
      return null;
    }
  },

  async deleteFile(id: string): Promise<boolean> {
    try {
      const container = getContainerClient();
      const blob = container.getBlockBlobClient(id);
      await blob.deleteIfExists();
      return true;
    } catch (error) {
      console.error(`Erreur suppression blob ${id}:`, error);
      return false;
    }
  },

  // Supprime les fichiers plus vieux que maxAgeMinutes (appelé en arrière-plan)
  async cleanupOldFiles(maxAgeMinutes: number = MAX_AGE_MINUTES): Promise<void> {
    try {
      const container = getContainerClient();
      const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
      let cleaned = 0;

      for await (const blob of container.listBlobsFlat({ includeMetadata: true })) {
        const ts = blob.metadata?.timestamp;
        if (ts && parseInt(ts) < cutoff) {
          await container.deleteBlob(blob.name);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        console.log(`${cleaned} fichiers temporaires Azure Blob nettoyés.`);
      }
    } catch (error) {
      console.error("Erreur nettoyage Azure Blob:", error);
    }
  },
};

// ============================================================
// Nettoyage automatique toutes les heures — singleton global
// ============================================================

const CLEANUP_KEY = "__fileStorageCleanupInterval__";
const g = globalThis as Record<string, unknown>;

if (!g[CLEANUP_KEY]) {
  g[CLEANUP_KEY] = setInterval(() => {
    fileStorage.cleanupOldFiles().catch((err) =>
      console.error("Erreur nettoyage automatique:", err)
    );
  }, 60 * 60 * 1000);
}
