import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

export const dynamic = "force-dynamic";

// État d'Yparéo pour le tableau de bord : « accessible » ou non.
// Le résultat est mémorisé 60 s pour ne pas solliciter Yparéo à chaque affichage de la page.
let lastCheck: { ok: boolean; checkedAt: number } | null = null;
const CHECK_TTL_MS = 60_000;
const CHECK_TIMEOUT_MS = 6_000;

async function checkYmag(): Promise<boolean> {
  const url = process.env.URL_REQUETEUR;
  const token = process.env.TOKEN_REQUETEUR;
  if (!url || !token) return false;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "X-Auth-Token": token, "Content-Type": "application/json", Accept: "application/json" },
      // Requête minimale, la même que celle qui charge la liste des campus
      body: JSON.stringify({ sql: "SELECT TOP 1 CODE_SITE FROM SITE" }),
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  if (!lastCheck || Date.now() - lastCheck.checkedAt > CHECK_TTL_MS) {
    lastCheck = { ok: await checkYmag(), checkedAt: Date.now() };
  }

  // Date de la dernière copie de secours des listes (campus), utile quand Yparéo est injoignable
  let cacheUpdatedAt: string | null = null;
  if (!lastCheck.ok) {
    const cached = await prisma.ymageCache
      .findUnique({ where: { key: "sites" }, select: { updatedAt: true } })
      .catch(() => null);
    cacheUpdatedAt = cached?.updatedAt.toISOString() ?? null;
  }

  return NextResponse.json({
    ok: lastCheck.ok,
    checkedAt: new Date(lastCheck.checkedAt).toISOString(),
    cacheUpdatedAt,
  });
}
