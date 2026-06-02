import fs from "fs";
import os from "os";
import path from "path";

// ============================================================
// DÉTECTION DU MODE : Azure Blob ou stockage local
// ============================================================

const USE_AZURE = !!process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = "bulletins";
const MAX_AGE_MINUTES = 60;

if (!USE_AZURE) {
  console.warn(
    "[fileStorage] AZURE_STORAGE_CONNECTION_STRING absent → stockage local activé (1 instance max)"
  );
}

// ============================================================
// STOCKAGE LOCAL ASYNC (fallback sans Azure)
// ============================================================

const LOCAL_DIR = path.join(os.tmpdir(), "bulletins-temp");

/** Crée le dossier temporaire s'il n'existe pas (non bloquant). */
async function ensureLocalDir(): Promise<void> {
  await fs.promises.mkdir(LOCAL_DIR, { recursive: true });
}

/** Vérifie l'existence d'un chemin sans bloquer le thread. */
async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
  }
}

const localStore = {
  async storeFile(id: string, data: Buffer, contentType = "application/zip"): Promise<void> {
    await ensureLocalDir();
    await Promise.all([
      fs.promises.writeFile(path.join(LOCAL_DIR, id), data),
      fs.promises.writeFile(
        path.join(LOCAL_DIR, `${id}.meta.json`),
        JSON.stringify({ contentType, timestamp: Date.now() })
      ),
    ]);
  },

  async hasFile(id: string): Promise<boolean> {
    return pathExists(path.join(LOCAL_DIR, id));
  },

  async getFile(id: string): Promise<{ data: Buffer; contentType: string } | null> {
    const filePath = path.join(LOCAL_DIR, id);
    const metaPath = path.join(LOCAL_DIR, `${id}.meta.json`);
    if (!(await pathExists(filePath)) || !(await pathExists(metaPath))) return null;
    const [data, metaRaw] = await Promise.all([
      fs.promises.readFile(filePath),
      fs.promises.readFile(metaPath, "utf8"),
    ]);
    const meta = JSON.parse(metaRaw);
    return { data, contentType: meta.contentType };
  },

  async deleteFile(id: string): Promise<boolean> {
    const targets = [
      path.join(LOCAL_DIR, id),
      path.join(LOCAL_DIR, `${id}.meta.json`),
    ];
    await Promise.allSettled(targets.map((p) => fs.promises.unlink(p)));
    return true;
  },

  async cleanupOldFiles(maxAgeMinutes = MAX_AGE_MINUTES): Promise<void> {
    await ensureLocalDir();
    const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
    let cleaned = 0;

    const files = await fs.promises.readdir(LOCAL_DIR);
    await Promise.all(
      files
        .filter((f) => !f.endsWith(".meta.json"))
        .map(async (file) => {
          const metaPath = path.join(LOCAL_DIR, `${file}.meta.json`);
          if (!(await pathExists(metaPath))) return;
          try {
            const raw = await fs.promises.readFile(metaPath, "utf8");
            const meta = JSON.parse(raw);
            if ((meta.timestamp || 0) < cutoff) {
              await localStore.deleteFile(file);
              cleaned++;
            }
          } catch {}
        })
    );

    if (cleaned > 0) console.log(`[fileStorage] ${cleaned} fichiers locaux nettoyés.`);
  },
};

// ============================================================
// STOCKAGE AZURE BLOB (production avec plusieurs instances)
// ============================================================

async function getContainerClient() {
  const { BlobServiceClient } = await import("@azure/storage-blob");
  const client = BlobServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!
  );
  return client.getContainerClient(CONTAINER_NAME);
}

const azureStore = {
  async storeFile(id: string, data: Buffer, contentType = "application/zip"): Promise<void> {
    const container = await getContainerClient();
    const blob = container.getBlockBlobClient(id);
    await blob.upload(data, data.length, {
      blobHTTPHeaders: { blobContentType: contentType },
      metadata: { timestamp: Date.now().toString(), contentType },
    });
  },

  async hasFile(id: string): Promise<boolean> {
    try {
      const container = await getContainerClient();
      await container.getBlockBlobClient(id).getProperties();
      return true;
    } catch {
      return false;
    }
  },

  async getFile(id: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const container = await getContainerClient();
      const blob = container.getBlockBlobClient(id);
      const props = await blob.getProperties();
      const download = await blob.download();
      const chunks: Buffer[] = [];
      for await (const chunk of download.readableStreamBody as AsyncIterable<Buffer>) {
        chunks.push(Buffer.from(chunk));
      }
      return {
        data: Buffer.concat(chunks),
        contentType: props.contentType || "application/zip",
      };
    } catch {
      return null;
    }
  },

  async deleteFile(id: string): Promise<boolean> {
    try {
      const container = await getContainerClient();
      await container.getBlockBlobClient(id).deleteIfExists();
      return true;
    } catch (err) {
      console.error(`[fileStorage] Erreur suppression blob ${id}:`, err);
      return false;
    }
  },

  async cleanupOldFiles(maxAgeMinutes = MAX_AGE_MINUTES): Promise<void> {
    try {
      const container = await getContainerClient();
      const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
      let cleaned = 0;
      for await (const blob of container.listBlobsFlat({ includeMetadata: true })) {
        const ts = blob.metadata?.timestamp;
        if (ts && parseInt(ts) < cutoff) {
          await container.deleteBlob(blob.name);
          cleaned++;
        }
      }
      if (cleaned > 0) console.log(`[fileStorage] ${cleaned} blobs Azure nettoyés.`);
    } catch (err) {
      console.error("[fileStorage] Erreur nettoyage Azure:", err);
    }
  },
};

// ============================================================
// API UNIFIÉE — même interface async pour le reste de l'app
// ============================================================

export const fileStorage = {
  async storeFile(id: string, data: Buffer, contentType?: string): Promise<void> {
    if (USE_AZURE) return azureStore.storeFile(id, data, contentType);
    return localStore.storeFile(id, data, contentType);
  },
  async hasFile(id: string): Promise<boolean> {
    if (USE_AZURE) return azureStore.hasFile(id);
    return localStore.hasFile(id);
  },
  async getFile(id: string): Promise<{ data: Buffer; contentType: string } | null> {
    if (USE_AZURE) return azureStore.getFile(id);
    return localStore.getFile(id);
  },
  async deleteFile(id: string): Promise<boolean> {
    if (USE_AZURE) return azureStore.deleteFile(id);
    return localStore.deleteFile(id);
  },
  async cleanupOldFiles(maxAgeMinutes?: number): Promise<void> {
    if (USE_AZURE) return azureStore.cleanupOldFiles(maxAgeMinutes);
    return localStore.cleanupOldFiles(maxAgeMinutes);
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
      console.error("[fileStorage] Erreur nettoyage automatique:", err)
    );
  }, 60 * 60 * 1000);
}
