import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        // En production, utilise le pooler Neon (port 6543) pour éviter de saturer
        // les connexions avec plusieurs utilisateurs simultanés.
        // Configure DATABASE_URL sur le port direct (5432) et
        // DIRECT_URL sur le port direct pour les migrations Prisma.
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

// ✅ Singleton : une seule instance partagée même en production
globalThis.prisma = prisma;