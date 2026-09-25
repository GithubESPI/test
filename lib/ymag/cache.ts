/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "@/lib/db/client";

/**
 * Wraps an Ymag/YParéo API call with a PostgreSQL cache fallback.
 *
 * ✅ On success  → stores fresh data in YmageCache (upsert), returns it
 * ⚠️ On failure  → returns stale cached data if any exists (regardless of expiry)
 * ❌ No cache    → re-throws the original API error
 *
 * @param key     Unique cache key  ex: "periods" | "groups" | "sites" | "sql_42_123"
 * @param ttlSec  Cache TTL in seconds (freshness marker only —
 *                stale entries are still used as fallback on Ymag failure)
 * @param fetchFn Async function that calls the real Ymag/YParéo API
 */
export async function withYmageCache<T>(
  key: string,
  ttlSec: number,
  fetchFn: () => Promise<T>,
  options: { freshSec?: number } = {}
): Promise<{ data: T; fromCache: boolean }> {
  // ── 0. Cache frais → servi directement, sans appeler Ymag ────────────────
  // (uniquement si freshSec est fourni : pour les listes quasi statiques)
  if (options.freshSec && options.freshSec > 0) {
    try {
      const cached = await prisma.ymageCache.findUnique({ where: { key } });
      if (cached && Date.now() - cached.updatedAt.getTime() < options.freshSec * 1000) {
        // fromCache reste false : ce n'est pas un repli (Ymag n'est pas en panne),
        // sinon les routes afficheraient « Ymag temporairement inaccessible ».
        return { data: cached.data as T, fromCache: false };
      }
    } catch (dbError) {
      console.error(`⚠️ DB error reading fresh cache "${key}":`, dbError);
    }
  }

  // ── 1. Try live Ymag API ─────────────────────────────────────────────────
  try {
    const data = await fetchFn();

    // Update cache — fire-and-forget so a DB hiccup never blocks the response
    const expiresAt = new Date(Date.now() + ttlSec * 1000);
    prisma.ymageCache
      .upsert({
        where: { key },
        update: { data: data as any, expiresAt },
        create: { key, data: data as any, expiresAt },
      })
      .catch((err) =>
        console.error(`⚠️ YmageCache write error for "${key}":`, err)
      );

    return { data, fromCache: false };
  } catch (apiError) {
    // ── 2. Ymag KO — try DB cache fallback ──────────────────────────────────
    try {
      const cached = await prisma.ymageCache.findUnique({ where: { key } });
      if (cached) {
        const expired = cached.expiresAt < new Date();
        console.warn(
          `⚠️ Ymag KO — cache fallback "${key}" ` +
            `(${expired ? "EXPIRÉ" : "valide"}, màj: ${cached.updatedAt.toISOString()})`
        );
        return { data: cached.data as T, fromCache: true };
      }
    } catch (dbError) {
      console.error(`❌ DB error during cache fallback "${key}":`, dbError);
    }

    // ── 3. No cache available → propagate the original API error ────────────
    throw apiError;
  }
}
