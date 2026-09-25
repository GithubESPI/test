import fs from "fs";
import os from "os";
import path from "path";
import { RETENTION_MINUTES } from "./retention";

// ============================================================
// DÉTECTION DU MODE : Azure Blob ou stockage local
// ============================================================

// En développement, on n'écrit PAS dans le partage Azure de production (même si la chaîne de
// connexion est dans .env) : stockage local. Pour forcer Azure en local : FORCE_AZURE_STORAGE=1.
const USE_AZURE =
  !!process.env.AZURE_STORAGE_CONNECTION_STRING &&
  (process.env.NODE_ENV === "production" || process.env.FORCE_AZURE_STORAGE === "1");
const SHARE_NAME = "bulletins"; // partage Azure Files (compte de type FileStorage)
const MAX_AGE_MINUTES = RETENTION_MINUTES; // durée de conservation des ZIP (cf. retention.ts)

if (!USE_AZURE) {
  console.warn(
    "[fileStorage] Stockage local activé (Azure désactivé : chaîne absente ou mode développement)"
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
// STOCKAGE AZURE FILES (production avec plusieurs instances)
// Compte de type FileStorage → on utilise un "partage de fichiers"
// (et non des Blobs). Stockage partagé entre toutes les instances.
// ============================================================

// Garde-fou : on ne tente la création du partage qu'une seule fois par process
let shareEnsured = false;

async function getShareClient() {
  const { ShareServiceClient } = await import("@azure/storage-file-share");
  const svc = ShareServiceClient.fromConnectionString(
    process.env.AZURE_STORAGE_CONNECTION_STRING!
  );
  const share = svc.getShareClient(SHARE_NAME);

  // Crée le partage "bulletins" s'il n'existe pas encore
  if (!shareEnsured) {
    try {
      await share.createIfNotExists();
      shareEnsured = true;
    } catch (err) {
      console.error("[fileStorage] Impossible de créer/vérifier le partage Azure Files:", err);
    }
  }

  return share;
}

const azureStore = {
  async storeFile(id: string, data: Buffer, contentType = "application/zip"): Promise<void> {
    const share = await getShareClient();
    const file = share.rootDirectoryClient.getFileClient(id);
    // uploadData gère automatiquement le découpage en segments (fichiers volumineux)
    await file.uploadData(data, {
      fileHttpHeaders: { fileContentType: contentType },
    });
  },

  async hasFile(id: string): Promise<boolean> {
    try {
      const share = await getShareClient();
      await share.rootDirectoryClient.getFileClient(id).getProperties();
      return true;
    } catch {
      return false;
    }
  },

  async getFile(id: string): Promise<{ data: Buffer; contentType: string } | null> {
    try {
      const share = await getShareClient();
      const file = share.rootDirectoryClient.getFileClient(id);
      const props = await file.getProperties();
      const download = await file.download();
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
      const share = await getShareClient();
      await share.rootDirectoryClient.getFileClient(id).deleteIfExists();
      return true;
    } catch (err) {
      console.error(`[fileStorage] Erreur suppression fichier ${id}:`, err);
      return false;
    }
  },

  async cleanupOldFiles(maxAgeMinutes = MAX_AGE_MINUTES): Promise<void> {
    try {
      const share = await getShareClient();
      const dir = share.rootDirectoryClient;
      const cutoff = Date.now() - maxAgeMinutes * 60 * 1000;
      let cleaned = 0;

      for await (const item of dir.listFilesAndDirectories()) {
        if (item.kind !== "file") continue;
        try {
          const file = dir.getFileClient(item.name);
          const props = await file.getProperties();
          if (props.lastModified && props.lastModified.getTime() < cutoff) {
            await file.deleteIfExists();
            cleaned++;
          }
        } catch {
          // fichier déjà supprimé entre-temps → on ignore
        }
      }

      if (cleaned > 0) console.log(`[fileStorage] ${cleaned} fichiers Azure nettoyés.`);
    } catch (err) {
      console.error("[fileStorage] Erreur nettoyage Azure Files:", err);
    }
  },
};

// ============================================================
// API UNIFIÉE — même interface async pour le reste de l'app
// ============================================================

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const fileStorage = {
  async storeFile(id: string, data: Buffer, contentType?: string): Promise<void> {
    if (!USE_AZURE) return localStore.storeFile(id, data, contentType);

    // Azure Files : 3 tentatives (une coupure réseau / DNS passagère ne doit pas
    // faire perdre toute la génération), puis repli sur le stockage local de l'instance.
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await azureStore.storeFile(id, data, contentType);
      } catch (err) {
        lastError = err;
        console.error(`[fileStorage] Écriture Azure échouée (tentative ${attempt}/3) :`, (err as Error).message);
        if (attempt < 3) await sleep(500 * attempt);
      }
    }
    console.error("[fileStorage] Azure indisponible → repli sur le stockage local de cette instance", lastError);
    return localStore.storeFile(id, data, contentType);
  },
  async hasFile(id: string): Promise<boolean> {
    if (!USE_AZURE) return localStore.hasFile(id);
    return (await azureStore.hasFile(id)) || (await localStore.hasFile(id));
  },
  async getFile(id: string): Promise<{ data: Buffer; contentType: string } | null> {
    if (!USE_AZURE) return localStore.getFile(id);
    return (await azureStore.getFile(id)) ?? (await localStore.getFile(id));
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
