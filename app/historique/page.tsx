"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FileText, LayoutDashboard, LogOut, Clock, FileDown, Calendar, Users, Building2 } from "lucide-react";
import { useEffect, useState } from "react";

// ============================================================
// TYPES
// ============================================================

interface Generation {
  id: string;
  campus: string;
  groupe: string;
  periode: string;
  nbBulletins: number;
  createdAt: string;
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
// CARTE GÉNÉRATION
// ============================================================

function GenerationCard({ generation }: { generation: Generation }) {
  const date = new Date(generation.createdAt);
  const dateStr = date.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const timeStr = date.toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 hover:border-gray-200 hover:shadow-sm transition-all">
      {/* Icône */}
      <div className="w-10 h-10 rounded-lg bg-[#e6f1fb] flex items-center justify-center shrink-0">
        <FileDown className="w-5 h-5 text-[#156082]" />
      </div>

      {/* Infos */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-gray-900 truncate">{generation.groupe}</span>
          <span className="text-xs bg-[#e6f1fb] text-[#156082] px-2 py-0.5 rounded-full shrink-0">
            {generation.nbBulletins} bulletin{generation.nbBulletins > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Building2 className="w-3 h-3" />
            {generation.campus}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <Users className="w-3 h-3" />
            {generation.periode}
          </div>
        </div>
      </div>

      {/* Date */}
      <div className="text-right shrink-0">
        <div className="flex items-center gap-1 text-xs text-gray-500 justify-end">
          <Calendar className="w-3 h-3" />
          {dateStr}
        </div>
        <div className="text-xs text-gray-400 mt-0.5">{timeStr}</div>
      </div>
    </div>
  );
}

// ============================================================
// PAGE HISTORIQUE
// ============================================================

export default function HistoriquePage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchGenerations = async () => {
      try {
        const res = await fetch("/api/generations");
        const data = await res.json();
        if (data.success) {
          setGenerations(data.data);
        }
      } catch (error) {
        console.error("Erreur chargement historique:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchGenerations();
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar title="Historique" />
        <main className="flex-1 p-6">

          {isLoading ? (
            <div className="flex items-center justify-center h-48">
              <div className="text-sm text-gray-400">Chargement...</div>
            </div>
          ) : generations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3">
              <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-gray-400" />
              </div>
              <div className="text-sm text-gray-500 text-center">
                Aucune génération pour le moment.
                <br />
                <Link href="/configure/form" className="text-[#156082] hover:underline mt-1 inline-block">
                  Générer vos premiers bulletins →
                </Link>
              </div>
            </div>
          ) : (
            <div className="max-w-2xl flex flex-col gap-3">
              <p className="text-xs text-gray-400 mb-1">
                {generations.length} génération{generations.length > 1 ? "s" : ""} — 10 dernières affichées
              </p>
              {generations.map((g) => (
                <GenerationCard key={g.id} generation={g} />
              ))}
            </div>
          )}

        </main>
      </div>
    </div>
  );
}