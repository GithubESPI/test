// 🔍 DIAGNOSTIC Azure Blob Storage — vérifie chaque élément séparément
// Usage : node --env-file=.env scripts/diagnostic-azure.mjs
//
// Teste dans l'ordre :
//   1) Les variables sont-elles présentes ?
//   2) La connection string est-elle bien formée (nom + clé lisibles) ?
//   3) Le compte de stockage existe-t-il vraiment ? (DNS mondial)
//   4) Peut-on se connecter et écrire/lire/supprimer ?

import dns from "dns";

const conn = process.env.AZURE_STORAGE_CONNECTION_STRING;
const name = process.env.AZURE_STORAGE_ACCOUNT_NAME;
const key = process.env.AZURE_STORAGE_ACCOUNT_KEY;

let stepNum = 0;
const ok = (msg) => console.log(`✅ Étape ${++stepNum} : ${msg}`);
const ko = (msg) => { console.log(`❌ Étape ${++stepNum} : ${msg}`); };

console.log("════════════════════════════════════════");
console.log("  DIAGNOSTIC AZURE BLOB STORAGE");
console.log("════════════════════════════════════════\n");

// ───── 1) Présence des variables ─────
console.log("1️⃣  Vérification des variables (.env)");
if (!conn) { ko("AZURE_STORAGE_CONNECTION_STRING manquante → ARRÊT"); process.exit(1); }
ok("La connection string est présente");
if (name) ok(`Nom du compte : ${name}`);
if (key) ok(`Clé présente (${key.length} caractères)`);
console.log("");

// ───── 2) Connection string bien formée ? ─────
console.log("2️⃣  Lecture de la connection string");
const parts = Object.fromEntries(
  conn.split(";").filter(Boolean).map((p) => {
    const i = p.indexOf("=");
    return [p.slice(0, i), p.slice(i + 1)];
  })
);
const accountName = parts.AccountName;
const accountKey = parts.AccountKey;

if (!accountName) { ko("Impossible de lire 'AccountName' dans la connection string"); process.exit(1); }
ok(`AccountName lu : ${accountName}`);
if (!accountKey) { ko("Impossible de lire 'AccountKey' dans la connection string"); process.exit(1); }
ok(`AccountKey lu : ${accountKey.slice(0, 6)}…${accountKey.slice(-4)} (masqué)`);

// Cohérence entre les variables
if (name && name !== accountName) {
  console.log(`⚠️  Attention : AZURE_STORAGE_ACCOUNT_NAME (${name}) ≠ AccountName de la connection string (${accountName})`);
}
console.log("");

// ───── 3) Le compte existe-t-il VRAIMENT ? (DNS) ─────
console.log("3️⃣  Le compte de stockage existe-t-il dans Azure ? (test DNS mondial)");
const host = `${accountName}.blob.core.windows.net`;
const resolver = new dns.promises.Resolver();
resolver.setServers(["8.8.8.8"]); // DNS public Google = vérité mondiale

let accountExists = false;
try {
  const addrs = await resolver.resolve4(host);
  ok(`Le compte EXISTE → ${host} pointe vers ${addrs[0]}`);
  accountExists = true;
} catch {
  ko(`Le compte N'EXISTE PAS → ${host} introuvable dans le DNS mondial`);
  console.log("    💡 Cela signifie que le Storage Account n'a jamais été créé,");
  console.log("       ou a été supprimé. Aucune clé ne peut le faire fonctionner.");
}
console.log("");

// ───── 4) Connexion réelle (seulement si le compte existe) ─────
console.log("4️⃣  Test de connexion réelle (écriture / lecture / suppression)");
if (!accountExists) {
  console.log("⏭️  Ignoré : inutile de tester la connexion, le compte n'existe pas.");
  console.log("\n════════════════════════════════════════");
  console.log("  VERDICT : ❌ Le compte de stockage doit d'abord être créé dans Azure.");
  console.log("════════════════════════════════════════");
  process.exit(1);
}

try {
  const { BlobServiceClient } = await import("@azure/storage-blob");
  const client = BlobServiceClient.fromConnectionString(conn);
  const container = client.getContainerClient("bulletins");

  await container.createIfNotExists();
  ok('Conteneur "bulletins" prêt');

  const testId = `diagnostic-${Date.now()}.txt`;
  const blob = container.getBlockBlobClient(testId);
  const content = Buffer.from("test diagnostic");
  await blob.upload(content, content.length);
  ok(`Écriture OK (${testId})`);

  const dl = await blob.download();
  const chunks = [];
  for await (const c of dl.readableStreamBody) chunks.push(c);
  ok(`Lecture OK ("${Buffer.concat(chunks).toString()}")`);

  await blob.deleteIfExists();
  ok("Suppression OK");

  console.log("\n════════════════════════════════════════");
  console.log("  VERDICT : 🎉 TOUT FONCTIONNE — Azure Blob est opérationnel !");
  console.log("════════════════════════════════════════");
} catch (err) {
  ko(`Connexion échouée : ${err.message}`);
  if (/AuthenticationFailed|Signature/i.test(err.message)) {
    console.log("    💡 La CLÉ est mauvaise ou périmée → récupère une clé fraîche dans Azure → Clés d'accès.");
  }
  console.log("\n════════════════════════════════════════");
  console.log("  VERDICT : ❌ Le compte existe mais la clé/connexion est incorrecte.");
  console.log("════════════════════════════════════════");
  process.exit(1);
}
