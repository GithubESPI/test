"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Clock, School, FileDown, X, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

// ============================================================
// TYPES
// ============================================================

interface Stats {
  bulletinsThisMonth: number;
  groupesThisMonth: number;
  campusActifs: number;
  hasSeenGuide: boolean;
}

// ============================================================
// SIDEBAR
// ============================================================

const NAV_ITEMS = [
  { href: "/home", label: "Tableau de bord", icon: LayoutDashboard },
  { href: "/configure/form", label: "Générer bulletins", icon: FileText },
  { href: "/historique", label: "Historique", icon: Clock },
];

function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 bg-[#003349] flex flex-col h-full min-h-screen py-5 px-3 shrink-0">
      <div className="flex items-center gap-2.5 px-2 pb-5 mb-1 border-b border-white/10">
        <div className="w-7 h-7 bg-white/15 rounded-lg flex items-center justify-center">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
          </svg>
        </div>
        <span className="text-white font-medium text-sm">ESPI</span>
      </div>

      <nav className="flex flex-col gap-1 mt-3 flex-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-white/12 text-white font-medium"
                  : "text-white/55 hover:text-white/80 hover:bg-white/8"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-white/40 hover:text-white/70 hover:bg-white/8 transition-colors mt-2"
      >
        <LogOut className="w-4 h-4 shrink-0" />
        Se déconnecter
      </button>
    </aside>
  );
}

// ============================================================
// TOPBAR
// ============================================================

function TopBar({ title }: { title: string }) {
  const { data: session } = useSession();
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  return (
    <div className="flex items-center justify-between h-14 px-6 border-b border-gray-100 bg-white shrink-0">
      <h1 className="text-base font-medium text-gray-900">{title}</h1>
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5">
        <div className="w-6 h-6 rounded-full bg-[#156082] flex items-center justify-center text-white text-xs font-medium">
          {initials}
        </div>
        <span className="text-xs text-gray-500">{session?.user?.name || "Utilisateur"}</span>
      </div>
    </div>
  );
}

// ============================================================
// MODAL GUIDE PREMIER LOGIN
// ============================================================

const GUIDE_STEPS = [
  {
    icon: School,
    iconBg: "#e6f1fb",
    iconColor: "#156082",
    title: "1. Sélectionnez le campus et le groupe",
    desc: "Choisissez votre campus puis le groupe d'apprenants pour lesquels générer les bulletins.",
  },
  {
    icon: FileText,
    iconBg: "#e1f5ee",
    iconColor: "#0f6e56",
    title: "2. Choisissez la période d'évaluation",
    desc: "Sélectionnez la période correspondante. Les données sont récupérées automatiquement.",
  },
  {
    icon: FileDown,
    iconBg: "#faeeda",
    iconColor: "#854f0b",
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
          className="flex items-center justify-center gap-2 w-full bg-[#156082] hover:bg-[#124f6b] text-white rounded-xl py-2.5 text-sm font-medium transition-colors"
        >
          Commencer la génération
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
}

// ============================================================
// PAGE HOME
// ============================================================

const ACTIONS = [
  {
    href: "/configure/form",
    title: "Générer des bulletins",
    sub: "Sélectionner campus et groupe",
    iconBg: "#e6f1fb",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#156082" strokeWidth={2}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
    ),
  },
  {
    href: "/historique",
    title: "Historique des générations",
    sub: "Consulter les archives",
    iconBg: "#e1f5ee",
    icon: (
      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="#0f6e56" strokeWidth={2}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
    ),
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [showGuide, setShowGuide] = useState(false);

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
    fetchStats();
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

  const STATS_ITEMS = [
    { num: stats?.bulletinsThisMonth?.toString() ?? "—", label: "Bulletins générés ce mois", color: "#156082" },
    { num: stats?.groupesThisMonth?.toString() ?? "—", label: "Groupes traités ce mois", color: "#003349" },
    { num: stats?.campusActifs?.toString() ?? "—", label: "Campus actifs", color: "#1d9e75" },
  ];

  return (
    <>
      {showGuide && <GuideModal onClose={handleCloseGuide} />}

      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <TopBar title="Tableau de bord" />
          <main className="flex-1 p-6 flex flex-col gap-6">

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {STATS_ITEMS.map((s) => (
                <div key={s.label} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="w-8 h-1 rounded-full mb-3" style={{ background: s.color }} />
                  <div className="text-2xl font-medium text-gray-900">{s.num}</div>
                  <div className="text-xs text-gray-500 mt-1">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Actions rapides */}
            <div>
              <h2 className="text-sm font-medium text-gray-500 mb-3">Actions rapides</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {ACTIONS.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-3 hover:border-gray-200 hover:shadow-sm transition-all"
                  >
                    <div
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: a.iconBg }}
                    >
                      {a.icon}
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-900">{a.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{a.sub}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

          </main>
        </div>
      </div>
    </>
  );
}