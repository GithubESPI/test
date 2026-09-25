"use client";

import { signOut, useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";

interface MeData {
  memberSince: string | null;
  totalGenerations: number;
  totalBulletins: number;
  lastGenerationAt: string | null;
}

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" }) : "—";

// Bouton « profil » de la barre du haut : au clic, affiche les informations du compte connecté.
export default function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState<MeData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const name = session?.user?.name || "Utilisateur";
  const email = session?.user?.email || "";
  const initials = session?.user?.name
    ? session.user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "?";

  // Chiffres du compte : chargés à la première ouverture seulement
  useEffect(() => {
    if (!open || me || loadFailed) return;
    fetch("/api/me")
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok || !json.success) throw new Error();
        setMe(json.data);
      })
      .catch(() => setLoadFailed(true));
  }, [open, me, loadFailed]);

  // Fermeture : clic à l'extérieur ou touche Échap
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-3 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#004976]"
      >
        <div className="w-6 h-6 rounded-full bg-[#004976] flex items-center justify-center text-white text-xs font-medium">
          {initials}
        </div>
        <span className="hidden sm:inline text-xs text-gray-500">{name}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-[calc(100vw-2rem)] max-w-72 bg-white border border-gray-100 rounded-xl shadow-lg z-50 overflow-hidden"
        >
          {/* Identité */}
          <div className="flex items-center gap-3 p-4 border-b border-gray-100">
            <div className="w-11 h-11 rounded-full bg-[#004976] flex items-center justify-center text-white text-sm font-medium shrink-0">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">{name}</div>
              <div className="text-xs text-gray-500 truncate" title={email}>{email}</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Compte Microsoft ESPI</div>
            </div>
          </div>

          {/* Activité */}
          <dl className="p-4 space-y-2 text-xs border-b border-gray-100">
            {loadFailed ? (
              <p className="text-gray-500">Informations d&apos;activité indisponibles pour le moment.</p>
            ) : !me ? (
              <div className="space-y-2 animate-pulse" aria-busy="true">
                <div className="h-3 bg-gray-100 rounded w-3/4" />
                <div className="h-3 bg-gray-100 rounded w-2/3" />
                <div className="h-3 bg-gray-100 rounded w-1/2" />
              </div>
            ) : (
              <>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Bulletins générés (total)</dt>
                  <dd className="text-gray-900 font-medium">{me.totalBulletins}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Générations (total)</dt>
                  <dd className="text-gray-900 font-medium">{me.totalGenerations}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Dernière génération</dt>
                  <dd className="text-gray-900 font-medium">{formatDate(me.lastGenerationAt)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-gray-500">Première connexion</dt>
                  <dd className="text-gray-900 font-medium">{formatDate(me.memberSince)}</dd>
                </div>
              </>
            )}
          </dl>

          {/* Déconnexion */}
          <button
            type="button"
            role="menuitem"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="flex items-center gap-2 w-full px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}
