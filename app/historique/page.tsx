"use client";

import Link from "next/link";
import UserMenu from "@/components/UserMenu";
import { MobileNav, Sidebar } from "@/components/AppNav";
import { Clock, Search, Info, AlertCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationCard, type Generation } from "@/components/GenerationCard";

// ============================================================
// TYPES
// ============================================================

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
// UTILITAIRES
// ============================================================

const PAGE_SIZE = 30;

interface Filters {
  q: string;
  campus: string;
  annee: string;
  periodeNom: string;
  range: string;
}

const EMPTY_FILTERS: Filters = { q: "", campus: "", annee: "", periodeNom: "", range: "" };

const RANGE_OPTIONS = [
  { value: "", label: "Toutes les dates" },
  { value: "today", label: "Aujourd'hui" },
  { value: "7d", label: "7 derniers jours" },
  { value: "30d", label: "30 derniers jours" },
];

function buildQuery(pageNumber: number, f: Filters) {
  const params = new URLSearchParams({ page: String(pageNumber), pageSize: String(PAGE_SIZE) });
  if (f.q) params.set("q", f.q);
  if (f.campus) params.set("campus", f.campus);
  if (f.annee) params.set("annee", f.annee);
  if (f.periodeNom) params.set("periodeNom", f.periodeNom);
  if (f.range) params.set("range", f.range);
  return params.toString();
}

const SELECT_CLASS =
  "h-10 px-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#004976] focus:ring-1 focus:ring-[#004976] min-w-0";

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(d: Date) {
  const now = new Date();
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  if (dayKey(d) === dayKey(now)) return "Aujourd'hui";
  if (dayKey(d) === dayKey(yesterday)) return "Hier";
  const label = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function groupByDay(generations: Generation[]) {
  const groups: { key: string; label: string; items: Generation[] }[] = [];
  for (const g of generations) {
    const d = new Date(g.createdAt);
    const key = dayKey(d);
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(g);
    else groups.push({ key, label: dayLabel(d), items: [g] });
  }
  return groups;
}

// ============================================================
// CARTE GÉNÉRATION
// ============================================================

function SkeletonCard() {
  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4 flex items-center gap-4 animate-pulse">
      <div className="w-10 h-10 rounded-lg bg-gray-100 shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-40 bg-gray-100 rounded" />
        <div className="h-3 w-64 max-w-full bg-gray-100 rounded" />
      </div>
      <div className="h-3 w-10 bg-gray-100 rounded" />
    </div>
  );
}

// ============================================================
// PAGE HISTORIQUE
// ============================================================

export default function HistoriquePage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [retentionDays, setRetentionDays] = useState(7);
  const [options, setOptions] = useState<{ campuses: string[]; periodes: string[]; annees: string[] }>({
    campuses: [],
    periodes: [],
    annees: [],
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [reloadKey, setReloadKey] = useState(0);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const activeFilterCount = [filters.q, filters.campus, filters.annee, filters.periodeNom, filters.range].filter(Boolean).length;
  const hasActiveFilter = activeFilterCount > 0;

  const setFilter = (key: keyof Filters, value: string) => setFilters((f) => ({ ...f, [key]: value }));

  // Recherche : on attend 300 ms après la dernière frappe avant d'interroger l'API
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.q === search.trim() ? f : { ...f, q: search.trim() })), 300);
    return () => clearTimeout(t);
  }, [search]);

  // (Re)chargement de la première page quand un filtre change
  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);

    fetch(`/api/generations?${buildQuery(1, filters)}`, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error("Erreur de chargement");
        setGenerations(data.data);
        setTotal(data.total);
        setHasMore(data.hasMore);
        if (typeof data.retentionDays === "number") setRetentionDays(data.retentionDays);
        setOptions(data.filters ?? { campuses: [], periodes: [], annees: [] });
        setPage(1);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        console.error("Erreur chargement historique:", err);
        setError("Impossible de charger l'historique. Vérifiez votre connexion et réessayez.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [filters, reloadKey]);

  const loadMore = useCallback(async () => {
    setIsLoadingMore(true);
    try {
      const res = await fetch(`/api/generations?${buildQuery(page + 1, filters)}`);
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error("Erreur de chargement");
      setGenerations((prev) => [...prev, ...data.data]);
      setHasMore(data.hasMore);
      setTotal(data.total);
      setPage((p) => p + 1);
    } catch {
      setError("Impossible de charger la suite. Réessayez.");
      setHasMore(false); // évite une boucle de tentatives automatiques ; le bouton reste disponible
    } finally {
      setIsLoadingMore(false);
    }
  }, [page, filters]);

  // Chargement automatique de la suite quand on arrive en bas de la liste
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasMore || isLoading || isLoadingMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "300px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoading, isLoadingMore, loadMore]);

  const resetFilters = () => {
    setSearch("");
    setFilters(EMPTY_FILTERS);
  };

  const groups = groupByDay(generations);

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
        <MobileNav />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar title="Historique" />
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24 md:pb-6">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">

            {/* Recherche + filtres */}
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un groupe, un campus, une période…"
                  aria-label="Rechercher dans l'historique"
                  className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-[#004976] focus:ring-1 focus:ring-[#004976]"
                />
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <select value={filters.campus} onChange={(e) => setFilter("campus", e.target.value)} aria-label="Filtrer par campus" className={SELECT_CLASS}>
                  <option value="">Tous les campus</option>
                  {options.campuses.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.annee} onChange={(e) => setFilter("annee", e.target.value)} aria-label="Filtrer par année académique" className={SELECT_CLASS}>
                  <option value="">Toutes les années</option>
                  {options.annees.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={filters.periodeNom} onChange={(e) => setFilter("periodeNom", e.target.value)} aria-label="Filtrer par période" className={SELECT_CLASS}>
                  <option value="">Toutes les périodes</option>
                  {options.periodes.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filters.range} onChange={(e) => setFilter("range", e.target.value)} aria-label="Filtrer par date" className={SELECT_CLASS}>
                  {RANGE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>

              {hasActiveFilter && (
                <button
                  onClick={resetFilters}
                  className="self-start inline-flex items-center gap-1 text-xs text-[#004976] hover:underline"
                >
                  <X className="w-3 h-3" />
                  Réinitialiser les filtres ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Compteur + rappel sur la durée de conservation des fichiers */}
            {!isLoading && !error && total > 0 && (
              <p className="text-xs text-gray-500">
                {total} génération{total > 1 ? "s" : ""}
                {hasActiveFilter ? " correspondant à vos filtres" : ""}
              </p>
            )}
            <div className="flex items-start gap-2 text-xs text-[#004976] bg-[#E6EDF1] rounded-lg px-3 py-2">
              <Info className="w-4 h-4 shrink-0 mt-px" />
              <span>
                Cliquez sur une ligne pour retélécharger les bulletins (archive ZIP). Les fichiers sont conservés
                {retentionDays} jour{retentionDays > 1 ? "s" : ""} après leur création, puis supprimés
                (la ligne d&apos;historique, elle, reste). Une ligne grisée n&apos;a plus de fichier : relancez la
                génération si vous en avez besoin.
              </span>
            </div>

            {isLoading ? (
              <div className="flex flex-col gap-3" aria-busy="true">
                {Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)}
              </div>
            ) : error && generations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                <div className="w-12 h-12 rounded-xl bg-[#FFDFE5] flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-[#FF7D97]" />
                </div>
                <p className="text-sm text-gray-600">{error}</p>
                <button
                  onClick={() => setReloadKey((k) => k + 1)}
                  className="text-sm text-white bg-[#004976] hover:bg-[#336D91] rounded-lg px-4 py-2 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            ) : generations.length === 0 ? (
              hasActiveFilter ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Search className="w-6 h-6 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500">Aucune génération ne correspond à vos filtres.</p>
                  <button onClick={resetFilters} className="text-sm text-[#004976] hover:underline">
                    Réinitialiser les filtres
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-gray-400" />
                  </div>
                  <div className="text-sm text-gray-500 text-center">
                    Aucune génération pour le moment.
                    <br />
                    <Link href="/configure/form" className="text-[#004976] hover:underline mt-1 inline-block">
                      Générer vos premiers bulletins →
                    </Link>
                  </div>
                </div>
              )
            ) : (
              <>
                {groups.map((group) => (
                  <section key={group.key} className="flex flex-col gap-2">
                    <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mt-2">
                      {group.label}
                    </h2>
                    {group.items.map((g) => (
                      <GenerationCard key={g.id} generation={g} retentionDays={retentionDays} />
                    ))}
                  </section>
                ))}

                {error && <p className="text-xs text-[#004976] bg-[#FFDFE5] rounded-lg px-3 py-2 text-center">{error}</p>}

                {/* Sentinelle : déclenche le chargement automatique en arrivant en bas */}
                <div ref={sentinelRef} aria-hidden="true" />

                {(hasMore || isLoadingMore || (error && generations.length < total)) && (
                  <button
                    onClick={loadMore}
                    disabled={isLoadingMore}
                    className="self-center text-sm text-[#004976] border border-[#004976]/30 hover:bg-[#E6EDF1] disabled:opacity-50 rounded-lg px-5 py-2 transition-colors"
                  >
                    {isLoadingMore ? "Chargement…" : "Afficher plus"}
                  </button>
                )}
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
