"use client";

import { signOut } from "next-auth/react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Clock, FileText, LayoutDashboard, LogOut } from "lucide-react";

const NAV_ITEMS = [
  { href: "/home", label: "Tableau de bord", short: "Accueil", icon: LayoutDashboard },
  { href: "/configure/form", label: "Générer vos bulletins", short: "Générer", icon: FileText },
  { href: "/historique", label: "Historique", short: "Historique", icon: Clock },
];

// Fond Bleu Élévation avec filigrane (charte ESPI)
const MOTIF_BG = {
  backgroundImage: "linear-gradient(rgba(0,73,118,0.88), rgba(0,73,118,0.88)), url('/images/espi-motif-bleu.png')",
};

// Barre latérale : visible à partir de la largeur « tablette » (md)
export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="hidden md:flex w-56 bg-[#004976] bg-cover bg-center flex-col sticky top-0 h-screen self-start overflow-y-auto py-5 px-3 shrink-0"
      style={MOTIF_BG}
    >
      <div className="px-2 pb-5 mb-1 border-b border-white/10">
        <Image src="/images/espi-logo-blanc.png" alt="ESPI" width={120} height={50} className="h-9 w-auto" priority />
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

// Navigation téléphone : barre d'onglets fixée en bas de l'écran (masquée à partir de md).
// La déconnexion se trouve dans le menu du profil, en haut à droite.
export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Navigation principale"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-[#004976] bg-cover bg-center border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      style={MOTIF_BG}
    >
      <ul className="flex">
        {NAV_ITEMS.map(({ href, short, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors ${
                  active ? "text-white font-medium" : "text-white/60 active:text-white"
                }`}
              >
                <Icon className="w-5 h-5" />
                {short}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
