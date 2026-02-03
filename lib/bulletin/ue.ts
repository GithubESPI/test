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

// À REMPLACER DANS lib/bulletin/ue.ts
// À remplacer dans lib/bulletin/ue.ts
export function getEtatUE(
  matiereEtats: Etat[],
  ueAverage: number | string | null | undefined
): Etat {
  // 1. Si une seule matière est explicitement en échec (NV), l'UE est NV
  if (matiereEtats.some((e) => e === "NV")) return "NV";

  // 2. On vérifie si on a des matières validées ou compensées (VA ou C)
  const hasValidData = matiereEtats.some((e) => e === "VA" || e === "C");

  const avg = parseUeAverage(ueAverage);

  // 3. CAS : PAS DE MOYENNE NUMÉRIQUE
  if (avg === null) {
    // Si pas de NV et qu'on a du VA/C, on valide
    return hasValidData ? "VA" : "NV";
  }

  // 4. CAS : MOYENNE NUMÉRIQUE PRÉSENTE
  // L'UE est VA si moyenne >= 10 (l'absence de NV est déjà vérifiée au point 1)
  return avg >= 10 ? "VA" : "NV";
}