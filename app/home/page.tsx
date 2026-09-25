"use client";

import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import { MobileNav, Sidebar } from "@/components/AppNav";
import { FileText, School, FileDown, X, ChevronRight, CheckCircle2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { GenerationCard, type Generation } from "@/components/GenerationCard";

// ============================================================
// TYPES
// ============================================================

interface CampusProgress {
  campus: string;
  groupes: number;
  bulletins: number;
  derniere: string | null;
}

interface Progression {
  periodes: string[];
  defaultPeriode: string | null;
  parPeriode: Record<string, CampusProgress[]>;
}

interface Stats {
  bulletinsThisMonth: number;
  groupesThisMonth: number;
  campusActifs: number;
  hasSeenGuide: boolean;
  progression: Progression;
}

interface YmagStatus {
  ok: boolean;
  checkedAt: string;
  cacheUpdatedAt: string | null;
}

// ============================================================
// TOPBAR
// ============================================================

function TopBar({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between h-14 px-4 sm:px-6 border-b border-gray-100 bg-white shrink-0">
      <h1 className="text-base font-semibold text-gray-900">{title}</h1>
      <UserMenu />
    </div>
  );
}

// ============================================================
// MODAL GUIDE PREMIER LOGIN
// ============================================================

const GUIDE_STEPS = [
  {
    icon: School,
    iconBg: "#E6EDF1",
    iconColor: "#004976",
    title: "1. Sélectionnez le campus et le groupe",
    desc: "Choisissez votre campus puis le groupe d'apprenants pour lesquels générer les bulletins.",
  },
  {
    icon: FileText,
    iconBg: "#E6EDF1",
    iconColor: "#004976",
    title: "2. Choisissez la période d'évaluation",
    desc: "Sélectionnez la période correspondante. Les données sont récupérées automatiquement.",
  },
  {
    icon: FileDown,
    iconBg: "#FFECD8",
    iconColor: "#004976",
    title: "3. Générez et téléchargez",
    desc: "Confirmez votre choix, attendez la génération puis téléchargez l'archive ZIP.",
  },
];

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Bienvenue sur la plateforme</h2>
            <p className="text-sm text-gray-500 mt-0.5">Voici comment générer vos bulletins en 3 étapes</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors ml-4 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Étapes */}
        <div className="space-y-4 mb-6">
          {GUIDE_STEPS.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: step.iconBg }}
              >
                <step.icon className="w-4 h-4" style={{ color: step.iconColor }} />
              </div>
              <div>
                <div className="text-sm font-medium text-gray-900">{step.title}</div>
                <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">{step.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <Link
          href="/configure/form"
          onClick={onClose}
          className="flex items-center justify-center gap-2 w-full bg-[#004976] hover:bg-[#336D91] text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
        >
          Commencer la génération
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// ÉTAT D'YPARÉO
// ============================================================

function YmagIndicator({ status }: { status: YmagStatus | null }) {
  if (!status) return null; // vérification en cours : on n'affiche rien

  if (status.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
        <span className="w-2 h-2 rounded-full bg-[#47B5E0]" aria-hidden="true" />
        Yparéo connecté
      </span>
    );
  }

  const copie = status.cacheUpdatedAt
    ? new Date(status.cacheUpdatedAt).toLocaleString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="flex items-start gap-3 text-sm text-[#004976] bg-[#FFDFE5] border border-[#FF7D97] rounded-lg px-4 py-3">
      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#FF7D97]" />
      <div>
        <p className="font-medium">Yparéo ne répond pas actuellement.</p>
        <p className="text-xs mt-0.5">
          La génération peut échouer : réessayez dans quelques minutes.
          {copie && <> Listes issues de la dernière copie du {copie}.</>}
        </p>
      </div>
    </div>
  );
}

// Lien vers le formulaire de génération, prérempli avec le campus, l'année et la période
function formHref(campus: string, periodeLabel: string | null) {
  const params = new URLSearchParams({ campus });
  const m = periodeLabel?.match(/^(.*?)\s*\((\d{4}-\d{4})\)\s*$/);
  if (m) {
    params.set("periode", m[1]);
    params.set("annee", m[2]);
  }
  return `/configure/form?${params.toString()}`;
}

// ============================================================
// AVANCEMENT PAR CAMPUS
// ============================================================

function CampusProgress({ progression }: { progression: Progression | null }) {
  const [selected, setSelected] = useState<string | null>(null);

  const periodes = progression?.periodes ?? [];
  const periode = selected && periodes.includes(selected) ? selected : progression?.defaultPeriode ?? null;
  const campuses = periode && progression ? progression.parPeriode[periode] ?? [] : [];
  const restants = campuses.filter((c) => c.groupes === 0);
  const termines = campuses.filter((c) => c.groupes > 0);

  return (
    <section className="bg-white border border-gray-100 rounded-xl p-5">
      <h2 className="text-sm font-medium text-gray-900 mb-3">Avancement par campus</h2>

      {periodes.length === 0 ? (
        <p className="text-sm text-gray-500">Vos campus apparaîtront ici après votre première génération.</p>
      ) : (
        <>
          <select
            value={periode ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            aria-label="Période"
            className="w-full h-9 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#004976] focus:ring-1 focus:ring-[#004976]"
          >
            {periodes.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {campuses.length === 0 ? (
            <p className="text-sm text-gray-500 mt-4">Aucun campus concerné par cette période.</p>
          ) : restants.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-[#004976] mt-4">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#47B5E0]" />
              Tous vos campus sont à jour.
            </p>
          ) : (
            <>
              <p className="flex items-center gap-2 text-sm text-gray-900 mt-4 mb-1">
                <span className="inline-flex items-center justify-center min-w-6 h-6 px-2 rounded-full bg-[#FF7D97] text-[#004976] text-xs font-semibold">
                  {restants.length}
                </span>
                campus restant{restants.length > 1 ? "s" : ""} à traiter
              </p>
              <ul className="flex flex-col divide-y divide-gray-100">
                {restants.map((c) => (
                  <li key={c.campus} className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-700">{c.campus}</span>
                    <Link href={formHref(c.campus, periode)} className="text-xs font-medium text-[#004976] hover:underline">
                      Générer
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {termines.length > 0 && restants.length > 0 && (
            <p className="text-xs text-gray-500 mt-3">
              Terminé : {termines.map((c) => c.campus).join(", ")}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// ============================================================
// PAGE HOME
// ============================================================

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [recent, setRecent] = useState<Generation[] | null>(null);
  const [retentionDays, setRetentionDays] = useState(7);
  const [ymagStatus, setYmagStatus] = useState<YmagStatus | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        if (data.success) {
          setStats(data.data);
          // Affiche le modal si l'utilisateur n'a jamais vu le guide
          if (!data.data.hasSeenGuide) {
            setShowGuide(true);
          }
        }
      } catch (error) {
        console.error("Erreur chargement stats:", error);
      }
    };

    const fetchRecent = async () => {
      try {
        const res = await fetch("/api/generations?page=1&pageSize=4");
        const data = await res.json();
        if (data.success) {
          setRecent(data.data);
          if (typeof data.retentionDays === "number") setRetentionDays(data.retentionDays);
        } else {
          setRecent([]);
        }
      } catch {
        setRecent([]);
      }
    };

    const fetchYmagStatus = async () => {
      try {
        const res = await fetch("/api/ymag-status");
        setYmagStatus(await res.json());
      } catch {
        // Impossible de joindre notre propre serveur : on n'affirme rien sur Yparéo
        setYmagStatus(null);
      }
    };

    fetchStats();
    fetchRecent();
    fetchYmagStatus();
  }, []);

  const handleCloseGuide = async () => {
    setShowGuide(false);
    // Marque le guide comme vu en BDD
    try {
      await fetch("/api/generations", { method: "PATCH" });
    } catch (error) {
      console.error("Erreur mise à jour guide:", error);
    }
  };

  const bulletins = stats?.bulletinsThisMonth ?? 0;
  const groupes = stats?.groupesThisMonth ?? 0;

  return (
    <>
      {showGuide && <GuideModal onClose={handleCloseGuide} />}

      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <MobileNav />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar title="Tableau de bord" />
          <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6">
            <div className="max-w-5xl mx-auto flex flex-col gap-10">

              {/* Action principale */}
              <div className="flex flex-col gap-3">
                {ymagStatus && !ymagStatus.ok && <YmagIndicator status={ymagStatus} />}

                <Link
                  href="/configure/form"
                  className="flex items-center justify-between gap-3 bg-[#004976] bg-cover bg-center text-white rounded-xl px-5 py-5 transition hover:brightness-125"
                  style={{ backgroundImage: "linear-gradient(rgba(0,73,118,0.88), rgba(0,73,118,0.88)), url('/images/espi-motif-bleu.png')" }}
                >
                  <div>
                    <div className="text-base font-medium">Générer vos bulletins</div>
                    <div className="text-sm text-white/70 mt-0.5">Campus, groupe, période</div>
                  </div>
                  <ChevronRight className="w-5 h-5 shrink-0" />
                </Link>

                <div className="flex items-center justify-between gap-3 px-1 text-xs text-gray-500">
                  <span>
                    Ce mois-ci : <strong className="font-medium text-gray-700">{bulletins} bulletin{bulletins > 1 ? "s" : ""}</strong>
                    {" "}· <strong className="font-medium text-gray-700">{groupes} groupe{groupes > 1 ? "s" : ""}</strong>
                  </span>
                  {ymagStatus?.ok && <YmagIndicator status={ymagStatus} />}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 lg:gap-10 items-start">
                {/* Derniers bulletins générés */}
                <section className="lg:col-span-3 flex flex-col gap-3">
                  <div className="flex items-baseline justify-between mb-1">
                    <h2 className="text-sm font-medium text-gray-900">Derniers bulletins générés</h2>
                    <Link href="/historique" className="text-xs text-[#004976] hover:underline">
                      Historique complet →
                    </Link>
                  </div>

                  {recent === null ? (
                    <div className="flex flex-col gap-3" aria-busy="true">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="bg-white border border-gray-100 rounded-xl h-[62px] animate-pulse" />
                      ))}
                    </div>
                  ) : recent.length === 0 ? (
                    <div className="bg-white border border-gray-100 rounded-xl p-6 text-center text-sm text-gray-500">
                      Aucun bulletin généré pour le moment.
                    </div>
                  ) : (
                    <>
                      {recent.map((g) => (
                        <GenerationCard key={g.id} generation={g} retentionDays={retentionDays} compact />
                      ))}
                      <p className="text-xs text-gray-500 px-1">
                        Cliquez sur une ligne pour retélécharger l&apos;archive (disponible {retentionDays} jour{retentionDays > 1 ? "s" : ""}).
                      </p>
                    </>
                  )}
                </section>

                {/* Avancement par campus */}
                <div className="lg:col-span-2">
                  <CampusProgress progression={stats?.progression ?? null} />
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
    </>
  );
}
