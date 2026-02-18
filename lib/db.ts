import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

export const prisma = globalThis.prisma || new PrismaClient();

// ✅ Toujours sauvegarder le singleton, même en production
globalThis.prisma = prisma;