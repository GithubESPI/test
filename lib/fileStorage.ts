import fs from "fs";
import os from "os";
import path from "path";

const dir = path.join(os.tmpdir(), "temp");
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

export const fileStorage = {
  storeFile(id: string, data: Buffer, contentType: string = "application/zip"): void {
    const filePath = path.join(dir, id);
    fs.writeFileSync(filePath, data);

    const metaFilePath = path.join(dir, `${id}.meta.json`);
    fs.writeFileSync(
      metaFilePath,
      JSON.stringify({ contentType, timestamp: Date.now() })
    );
  },

  hasFile(id: string): boolean {
    return fs.existsSync(path.join(dir, id));
  },

  getFile(id: string): { data: Buffer; contentType: string } | null {
    const filePath = path.join(dir, id);
    const metaFilePath = path.join(dir, `${id}.meta.json`);

    if (fs.existsSync(filePath) && fs.existsSync(metaFilePath)) {
      const data = fs.readFileSync(filePath);
      const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf8"));
      return { data, contentType: meta.contentType || "application/zip" };
    }
    return null;
  },

  deleteFile(id: string): boolean {
    const filePath = path.join(dir, id);
    const metaFilePath = path.join(dir, `${id}.meta.json`);
    let success = true;

    for (const p of [filePath, metaFilePath]) {
      if (fs.existsSync(p)) {
        try {
          fs.unlinkSync(p);
        } catch (error) {
          console.error(`Erreur suppression ${p}:`, error);
          success = false;
        }
      }
    }
    return success;
  },

  getAllFileIds(): string[] {
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => !file.endsWith(".meta.json"))
      .filter((file) => fs.statSync(path.join(dir, file)).isFile());
  },

  cleanupOldFiles(maxAgeMinutes: number = 60): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const file of this.getAllFileIds()) {
      const metaFilePath = path.join(dir, `${file}.meta.json`);
      if (!fs.existsSync(metaFilePath)) continue;

      try {
        const meta = JSON.parse(fs.readFileSync(metaFilePath, "utf8"));
        if (now - (meta.timestamp || 0) > maxAgeMinutes * 60 * 1000) {
          this.deleteFile(file);
          cleanedCount++;
        }
      } catch (error) {
        console.error(`Erreur lecture métadonnées ${file}:`, error);
      }
    }

    if (cleanedCount > 0) {
      console.log(`${cleanedCount} fichiers temporaires nettoyés.`);
    }
  },
};

// ✅ setInterval sécurisé : on stocke la ref pour éviter les doublons
// en cas de rechargement de module sur Azure
const CLEANUP_KEY = "__fileStorageCleanupInterval__";
const g = globalThis as any;

if (!g[CLEANUP_KEY]) {
  g[CLEANUP_KEY] = setInterval(() => {
    try {
      fileStorage.cleanupOldFiles();
    } catch (error) {
      console.error("Erreur nettoyage fichiers temporaires:", error);
    }
  }, 60 * 60 * 1000);
}