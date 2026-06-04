// 📂 Liste les fichiers présents dans le partage Azure Files "bulletins"
// Usage : node --env-file=.env scripts/list-azure-files.mjs

import { ShareServiceClient } from "@azure/storage-file-share";

const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
if (!conn) { console.error("❌ AZURE_STORAGE_CONNECTION_STRING absente"); process.exit(1); }

const svc = ShareServiceClient.fromConnectionString(conn);
const share = svc.getShareClient("bulletins");
const dir = share.rootDirectoryClient;

console.log('📂 Contenu du partage "bulletins" :\n');
let count = 0;
for await (const item of dir.listFilesAndDirectories()) {
  if (item.kind !== "file") continue;
  count++;
  try {
    const props = await dir.getFileClient(item.name).getProperties();
    const ko = Math.round((props.contentLength || 0) / 1024);
    console.log(`  • ${item.name}  (${ko} Ko, modifié ${props.lastModified?.toLocaleString("fr-FR")})`);
  } catch {
    console.log(`  • ${item.name}`);
  }
}
console.log(count === 0 ? "  (vide pour l'instant)" : `\n✅ ${count} fichier(s).`);
