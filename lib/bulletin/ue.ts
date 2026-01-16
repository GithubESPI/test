export type Etat = "VA" | "NV" | "C";

// ✅ Toute valeur libre → Etat ; "R" est converti en "NV"
export function normalizeEtat(s: string | undefined | null): Etat {
  const up = String(s ?? "")
    .trim()
    .toUpperCase();
  if (up === "R") return "NV"; // ← exigence : pas de R
  if (up === "VA" || up === "NV" || up === "C") return up;
  return "NV"; // fallback prudent
}

export const parseUeAverage = (v?: number | string | null): number | null => {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = String(v).trim();
  if (s === "" || s === "-" || s === "VA" || s === "NV" || s === "C") return null;
  const n = Number(s.replace(",", "."));
  return Number.isNaN(n) ? null : n;
};

export type UeAverageRow = {
  CODE_APPRENANT?: string | number | null;
  CODE_UE?: string | null;
  CODE_MATIERE?: string | null;
  MOYENNE_UE?: number | string | null;
  MOYENNE?: number | string | null;
};

// Petit helper sans any
const toKey = (v: unknown): string =>
  String(v ?? "")
    .trim()
    .toUpperCase();

// Ta fonction, typée
export function getUeAverage(
  ueAverages: ReadonlyArray<UeAverageRow>,
  ueCode: string,
  studentId?: string | number,
  matiereNom?: string // Ajoutez ce paramètre optionnel
): number | null {
  const target = toKey(ueCode);
  const targetNom = matiereNom ? toKey(matiereNom) : null;

  const row = ueAverages.find((a) => {
    const code = toKey(a.CODE_UE ?? a.CODE_MATIERE);
    const nom = (a as any).NOM_MATIERE ? toKey((a as any).NOM_MATIERE) : null;

    const okStudent = studentId == null ? true : String(a.CODE_APPRENANT ?? "") === String(studentId);

    // On cherche par CODE ou par NOM
    return okStudent && (code === target || (targetNom && nom === targetNom));
  });

  return parseUeAverage(row?.MOYENNE_UE ?? row?.MOYENNE);
}

export function getEtatUE(
  matiereEtats: Etat[],
  ueAverage: number | string | null | undefined
): Etat {
  // 1) Une seule NV en matière => UE = NV
  if (matiereEtats.some((e) => e === "NV")) return "NV";

  const allVA = matiereEtats.every((e) => e === "VA");
  const allVAorC = matiereEtats.every((e) => e === "VA" || e === "C");

  // 2) Moyenne numérique ?
  const avg = parseUeAverage(ueAverage);

  // 2.a) Moyenne absente => fallback: seulement si TOUT = VA on valide
  if (avg === null) return allVA ? "VA" : "NV";

  // 2.b) Règle stricte demandée
  if (allVAorC) return avg >= 10 ? "VA" : "NV";

  // Sécurité (normalement couvert par le test NV au début)
  return "NV";
}
