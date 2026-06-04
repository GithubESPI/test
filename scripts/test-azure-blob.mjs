// Script de test de la connexion Azure Blob Storage
// Usage : node scripts/test-azure-blob.mjs
//
// Vérifie : connexion → création conteneur → upload → lecture → suppression

import { BlobServiceClient } from "@azure/storage-blob";
import { readFileSync } from "fs";

// Lecture manuelle du .env (pas de dépendance dotenv)
try {
  const env = readFileSync(new URL("../.env", import.meta.url), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] ??= m[2];
  }
} catch {}

const CONTAINER = "bulletins";
const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;

if (!conn) {
  console.error("❌ AZURE_STORAGE_CONNECTION_STRING absente du .env");
  process.exit(1);
}

console.log("🔌 Connexion à Azure Blob Storage...");

try {
  const client = BlobServiceClient.fromConnectionString(conn);
  const container = client.getContainerClient(CONTAINER);

  // 1. Conteneur
  const created = await container.createIfNotExists();
  console.log(created.succeeded
    ? `✅ Conteneur "${CONTAINER}" créé`
    : `✅ Conteneur "${CONTAINER}" déjà présent`);

  // 2. Upload d'un fichier test
  const testId = `test-${Date.now()}.txt`;
  const content = Buffer.from("Test bulletins ESPI — " + new Date().toISOString());
  const blob = container.getBlockBlobClient(testId);
  await blob.upload(content, content.length);
  console.log(`✅ Upload réussi : ${testId} (${content.length} octets)`);

  // 3. Lecture
  const dl = await blob.download();
  const chunks = [];
  for await (const c of dl.readableStreamBody) chunks.push(c);
  const read = Buffer.concat(chunks).toString();
  console.log(`✅ Lecture réussie : "${read}"`);

  // 4. Suppression (nettoyage)
  await blob.deleteIfExists();
  console.log(`✅ Suppression réussie : ${testId}`);

  console.log("\n🎉 TOUT FONCTIONNE — Azure Blob est opérationnel !");
} catch (err) {
  console.error("\n❌ ÉCHEC :", err.message);
  console.error("\nVérifie : la connection string, la clé, et que le compte de stockage existe.");
  process.exit(1);
}
