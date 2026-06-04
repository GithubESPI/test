// 🔍 Exploration de la base MySQL Azure `espi`
// Usage : node --env-file=.env scripts/explore-mysql.mjs
//
// Teste la connexion, liste les tables, et compte les lignes.
// NE MODIFIE RIEN — lecture seule.

import mysql from "mysql2/promise";

const cfg = {
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  charset: "utf8mb4",
  ssl: { rejectUnauthorized: false }, // Azure MySQL impose SSL
  connectTimeout: 15000,
};

console.log("🔌 Connexion à", cfg.host, "/", cfg.database, "...\n");

let conn;
try {
  conn = await mysql.createConnection(cfg);
  console.log("✅ Connexion réussie !\n");
} catch (err) {
  console.error("❌ Connexion échouée :", err.code || err.message);
  if (err.code === "ER_ACCESS_DENIED_ERROR") {
    console.error("   → Identifiant ou mot de passe incorrect.");
    console.error("   → Sur Azure, essaie parfois l'utilisateur au format : adminSlq@vm-msql");
  } else if (err.code === "ETIMEDOUT" || err.code === "ENOTFOUND") {
    console.error("   → Le pare-feu Azure MySQL bloque cette IP, ou l'hôte est introuvable.");
    console.error("   → Ajoute ton IP dans Azure → MySQL → Mise en réseau → Règles de pare-feu.");
  }
  process.exit(1);
}

try {
  // 1. Liste des tables
  const [tables] = await conn.query("SHOW TABLES");
  const tableNames = tables.map((r) => Object.values(r)[0]);
  console.log(`📋 ${tableNames.length} table(s) dans la base "${cfg.database}" :\n`);

  // 2. Pour chaque table : nb de lignes + colonnes
  for (const t of tableNames) {
    try {
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM \`${t}\``);
      const [cols] = await conn.query(`SHOW COLUMNS FROM \`${t}\``);
      const colList = cols.map((c) => c.Field).join(", ");
      console.log(`  • ${t}  (${n} lignes)`);
      console.log(`      colonnes : ${colList}\n`);
    } catch (e) {
      console.log(`  • ${t}  (erreur lecture : ${e.message})\n`);
    }
  }

  console.log("════════════════════════════════════════");
  console.log(`✅ Exploration terminée — ${tableNames.length} tables trouvées.`);
  console.log("════════════════════════════════════════");
} catch (err) {
  console.error("❌ Erreur pendant l'exploration :", err.message);
} finally {
  await conn.end();
}
