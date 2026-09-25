"use client";

import { useState } from "react";
import { Building2, Clock, FileDown, Loader2, Users } from "lucide-react";

export interface Generation {
  id: string;
  campus: string;
  groupe: string;
  periode: string;
  nbBulletins: number;
  createdAt: string;
  available?: boolean; // le ZIP existe encore
}

export function GenerationCard({
  generation,
  retentionDays,
  compact = false,
}: {
  generation: Generation;
  retentionDays: number;
  compact?: boolean; // version condensée (tableau de bord)
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const created = new Date(generation.createdAt);
  const timeStr = created.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  // Le fichier ZIP est conservé `retentionDays` jours après sa génération
  const expiresAt = new Date(created.getTime() + retentionDays * 24 * 3600 * 1000);
  const isExpired = Date.now() > expiresAt.getTime();
  // Pas de fichier (généré avant le téléchargement depuis l'historique, ou déjà supprimé)
  const isUnavailable = isExpired || generation.available === false;
  const daysLeft = Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / (24 * 3600 * 1000)));

  const handleDownload = async () => {
    if (isUnavailable || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const res = await fetch(`/api/download?id=gen_${generation.id}.zip`);
      if (res.status === 404) {
        throw new Error("Fichier introuvable (généré avant la mise en place du téléchargement, ou supprimé). Relancez la génération.");
      }
      if (!res.ok) throw new Error("Le téléchargement a échoué. Réessayez.");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `bulletins_${generation.groupe.replace(/\s+/g, "_")}.zip`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : "Le téléchargement a échoué.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleDownload}
        disabled={isUnavailable || isDownloading}
        aria-label={
          isUnavailable
            ? `Fichier non disponible : ${generation.groupe}`
            : `Télécharger les bulletins de ${generation.groupe}`
        }
        title={
          isUnavailable && !isExpired
            ? "Aucun fichier associé : généré avant l'activation du téléchargement, ou déjà supprimé. Relancez la génération."
            : undefined
        }
        className={`w-full text-left bg-white border border-gray-100 rounded-xl ${compact ? "p-3" : "p-4"} flex items-center gap-3 sm:gap-4 transition-all ${
          isUnavailable
            ? "opacity-60 cursor-not-allowed"
            : "hover:border-[#004976]/40 hover:shadow-sm cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004976]"
        }`}
      >
        <div className={`${compact ? "w-8 h-8" : "w-10 h-10"} rounded-lg bg-[#E6EDF1] flex items-center justify-center shrink-0`}>
          {isDownloading ? (
            <Loader2 className="w-5 h-5 text-[#004976] animate-spin" />
          ) : (
            <FileDown className="w-5 h-5 text-[#004976]" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-900 truncate">{generation.groupe}</span>
            <span className="text-xs bg-[#E6EDF1] text-[#004976] px-2 py-0.5 rounded-full shrink-0">
              {generation.nbBulletins} bulletin{generation.nbBulletins > 1 ? "s" : ""}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Building2 className="w-3 h-3" />
              {generation.campus}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Users className="w-3 h-3" />
              {generation.periode}
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {timeStr}
          </div>
          <span className={`text-[11px] ${isUnavailable ? "text-gray-400" : "text-[#004976]"}`}>
            {isUnavailable
              ? isExpired
                ? "Expiré"
                : "Non disponible"
              : isDownloading
                ? "Téléchargement…"
                : compact
                  ? "Télécharger"
                  : `Télécharger · encore ${daysLeft} jour${daysLeft > 1 ? "s" : ""}`}
          </span>
        </div>
      </button>
      {downloadError && <p className="text-xs text-[#004976] bg-[#FFDFE5] rounded-md px-3 py-2">{downloadError}</p>}
    </div>
  );
}
