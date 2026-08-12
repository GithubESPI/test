/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle2, FileDown, FileText, Loader2, XCircle, ChevronLeft } from "lucide-react";
import { useSession } from "next-auth/react";
import { useCallback, useEffect, useReducer, useRef } from "react";
import Link from "next/link";

// ============================================================
// TYPES
// ============================================================

interface PeriodeEvaluation {
  CODE_PERIODE_EVALUATION: string;
  NOM_PERIODE_EVALUATION: string;
  DATE_DEB: string;
  DATE_FIN: string;
}

// Année académique Yparéo (table SESSION) — ex: CODE_SESSION 5 = "2025-2026"
interface AcademicSession {
  CODE_SESSION: string;
  NOM_SESSION: string;
  DATE_DEB: string;
  DATE_FIN: string;
}

interface SiteInfo {
  CODE_SITE: number;
  NOM_SITE: string;
}

interface YpareoGroup {
  codeGroupe: number;
  nomGroupe: string;
  codeSite: number;
}

interface Campus {
  id: string;
  codeSite: number;
  label: string;
}

interface Group {
  id: number;
  label: string;
}

type Modal = "none" | "success" | "error" | "pdfSuccess";

// ============================================================
// REDUCER
// ============================================================

interface State {
  sessions: AcademicSession[];
  sites: SiteInfo[];
  campuses: Campus[];
  allGroups: YpareoGroup[];
  groups: Group[];
  periods: PeriodeEvaluation[];
  session: string;
  campus: string;
  group: string;
  semester: string;
  groupPeriods: PeriodeEvaluation[];
  isLoading: boolean;
  isLoadingGroups: boolean;
  isLoadingPeriods: boolean;
  isSubmitting: boolean;
  isGeneratingPDF: boolean;
  progress: number;
  isLoadingComplete: boolean;
  modal: Modal;
  errorMessage: string;
  retrievedData: any;
  pdfDownloadUrl: string;
  pdfStudentCount: number;
  pdfFromCache: boolean;
  selectedGroupName: string;
  // Overlay de progression
  overlaySteps: { label: string; status: "done" | "current" | "todo" }[];
  overlayProgress: number;
}

const initialState: State = {
  sessions: [], sites: [], campuses: [], allGroups: [], groups: [], periods: [],
  session: "", campus: "", group: "", semester: "", groupPeriods: [],
  isLoading: true, isLoadingGroups: false, isLoadingPeriods: false, isSubmitting: false, isGeneratingPDF: false,
  progress: 0, isLoadingComplete: false,
  modal: "none", errorMessage: "",
  retrievedData: null, pdfDownloadUrl: "", pdfStudentCount: 0, pdfFromCache: false, selectedGroupName: "",
  overlaySteps: [], overlayProgress: 0,
};

type Action =
  | { type: "INIT_DATA"; sessions: AcademicSession[]; sites: SiteInfo[]; session: string; campuses: Campus[]; groups: YpareoGroup[]; periods: PeriodeEvaluation[] }
  | { type: "SET_SESSION"; session: string }
  | { type: "SET_SESSION_GROUPS"; campuses: Campus[]; groups: YpareoGroup[] }
  | { type: "SET_CAMPUS"; campus: string; groups: Group[] }
  | { type: "SET_GROUP"; group: string }
  | { type: "SET_GROUP_PERIODS"; periods: PeriodeEvaluation[] }
  | { type: "SET_SEMESTER"; semester: string }
  | { type: "SET_LOADING_DONE" }
  | { type: "SET_PROGRESS"; progress: number }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_GENERATING"; value: boolean }
  | { type: "SQL_SUCCESS"; data: any; groupName: string }
  | { type: "PDF_SUCCESS"; url: string; count: number; fromCache: boolean; groupName: string }
  | { type: "SHOW_ERROR"; message: string }
  | { type: "CLOSE_MODAL" }
  | { type: "SET_OVERLAY_STEPS"; steps: { label: string; status: "done" | "current" | "todo" }[] }
  | { type: "SET_OVERLAY_PROGRESS"; progress: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT_DATA": return { ...state, sessions: action.sessions, sites: action.sites, session: action.session, campuses: action.campuses, allGroups: action.groups, periods: action.periods, isLoading: false };
    case "SET_SESSION": return { ...state, session: action.session, campus: "", group: "", semester: "", groups: [], groupPeriods: [], isLoadingGroups: true };
    case "SET_SESSION_GROUPS": return { ...state, campuses: action.campuses, allGroups: action.groups, isLoadingGroups: false };
    case "SET_CAMPUS": return { ...state, campus: action.campus, groups: action.groups, group: "", semester: "", groupPeriods: [] };
    case "SET_GROUP": return { ...state, group: action.group, semester: "", groupPeriods: [], isLoadingPeriods: true };
    case "SET_GROUP_PERIODS": return { ...state, groupPeriods: action.periods, isLoadingPeriods: false };
    case "SET_SEMESTER": return { ...state, semester: action.semester };
    case "SET_LOADING_DONE": return { ...state, isLoadingComplete: true };
    case "SET_PROGRESS": return { ...state, progress: action.progress };
    case "SET_SUBMITTING": return { ...state, isSubmitting: action.value };
    case "SET_GENERATING": return { ...state, isGeneratingPDF: action.value };
    case "SQL_SUCCESS": return { ...state, retrievedData: action.data, selectedGroupName: action.groupName, modal: "success" };
    case "PDF_SUCCESS": return { ...state, pdfDownloadUrl: action.url, pdfStudentCount: action.count, pdfFromCache: action.fromCache, selectedGroupName: action.groupName, modal: "pdfSuccess" };
    case "SHOW_ERROR": return { ...state, errorMessage: action.message, modal: "error" };
    case "CLOSE_MODAL": return { ...state, modal: "none" };
    case "SET_OVERLAY_STEPS": return { ...state, overlaySteps: action.steps };
    case "SET_OVERLAY_PROGRESS": return { ...state, overlayProgress: action.progress };
    default: return state;
  }
}

// ============================================================
// HELPERS
// ============================================================

const EXCLUDED_PREFIXES = ["P-BTS1","P-BTS2","M-BTS1","M-BTS2","N-BTS1","N-BTS2","L-BTS1","LI-BTS1","LI-BTS2","B-BTS1","MP-BTS1","MP-BTS2","B-BTS2"];
const EXCLUDED_TERMS = ["Césure", "RP", "DDS"];

function filterGroups(groups: Group[]): Group[] {
  return groups.filter((g) => {
    const startsExcluded = EXCLUDED_PREFIXES.some((p) => g.label.startsWith(p));
    const containsExcluded = EXCLUDED_TERMS.some((t) => g.label.includes(t));
    return !startsExcluded && !containsExcluded;
  });
}

function buildCampuses(groupsArray: YpareoGroup[], sites: SiteInfo[]): Campus[] {
  const siteNameMap = new Map<number, string>(sites.map((s) => [Number(s.CODE_SITE), s.NOM_SITE]));
  const uniqueCodeSites = [...new Set(groupsArray.map((g) => g.codeSite).filter(Boolean))];
  return uniqueCodeSites
    .map((codeSite, i) => ({ id: `campus-${codeSite}-${i}`, codeSite, label: siteNameMap.get(codeSite) ?? `Campus ${codeSite}` }))
    .filter((c) => c.label !== "GROUPE ESPI");
}

// Année académique en cours (aujourd'hui entre DATE_DEB et DATE_FIN), sinon la plus récente déjà commencée
function pickDefaultSession(sessions: AcademicSession[]): string {
  const now = new Date();
  const current = sessions.find((s) => new Date(s.DATE_DEB) <= now && now <= new Date(s.DATE_FIN));
  if (current) return current.CODE_SESSION;
  const started = sessions
    .filter((s) => new Date(s.DATE_DEB) <= now)
    .sort((a, b) => new Date(b.DATE_DEB).getTime() - new Date(a.DATE_DEB).getTime());
  return started[0]?.CODE_SESSION ?? sessions[0]?.CODE_SESSION ?? "";
}

function checkCoherence(groupName: string, periodName: string): string | null {
  const g = groupName.toUpperCase();
  const p = periodName.toUpperCase();
  if (g.includes("ALT") && p.includes("TP")) return "Incohérence : Groupe Alternance avec période Temps Plein.";
  if (g.includes("TP") && p.includes("ALT")) return "Incohérence : Groupe Temps Plein avec période Alternance.";
  return null;
}

async function downloadZip(url: string, filename: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Erreur téléchargement");
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// ============================================================
// STEP INDICATOR
// ============================================================

function StepIndicator({ step, label, status }: { step: number; label: string; status: "done" | "current" | "todo" }) {
  return (
    <div className="flex items-start gap-3">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium shrink-0 mt-0.5 ${
        status === "done" ? "bg-[#004976] text-white" :
        status === "current" ? "bg-white text-[#002a44] font-semibold" :
        "bg-white/10 text-white/40"
      }`}>
        {status === "done" ? "✓" : step}
      </div>
      <span className={`text-sm leading-relaxed ${
        status === "current" ? "text-white font-medium" :
        status === "done" ? "text-white/60" :
        "text-white/40"
      }`}>
        {label}
      </span>
    </div>
  );
}

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function FormPage() {
  const { data: session } = useSession();
  const [state, dispatch] = useReducer(reducer, initialState);
  const retrievedDataRef = useRef<any>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Détermination de l'étape courante
  const currentStep = !state.campus ? 1 : !state.group ? 2 : !state.semester ? 3 : 4;

  // Chargement initial
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [sessionsRes, periodsRes, sitesRes] = await Promise.all([
          fetch("/api/sessions"),
          fetch("/api/periods"),
          fetch("/api/students"),
        ]);
        if (!sessionsRes.ok || !periodsRes.ok) throw new Error("Erreur chargement données");

        const [sessionsData, periodsData] = await Promise.all([
          sessionsRes.json(),
          periodsRes.json(),
        ]);

        const sitesRaw = sitesRes.ok ? await sitesRes.json() : [];
        const sitesArray: SiteInfo[] = Array.isArray(sitesRaw) ? sitesRaw : Object.values(sitesRaw);

        // Années académiques déjà commencées + la prochaine rentrée (pour préparer les maquettes N+1),
        // de la plus récente à la plus ancienne
        const now = new Date();
        const allSessions: AcademicSession[] = sessionsData.success ? sessionsData.data : [];
        const started = allSessions.filter((s) => new Date(s.DATE_DEB) <= now);
        // 🚩 Prochaine rentrée (2026-2027) non proposée tant que la maquette n'est pas activée
        // (cf. ENABLE_MAQUETTE_2026 dans app/api/pdf/route.ts). Passer à true le moment venu.
        const SHOW_NEXT_SESSION = false;
        const nextSession = SHOW_NEXT_SESSION
          ? allSessions
              .filter((s) => new Date(s.DATE_DEB) > now)
              .sort((a, b) => new Date(a.DATE_DEB).getTime() - new Date(b.DATE_DEB).getTime())[0]
          : undefined;
        const sessions: AcademicSession[] = [...(nextSession ? [nextSession] : []), ...started]
          .sort((a, b) => new Date(b.DATE_DEB).getTime() - new Date(a.DATE_DEB).getTime());
        const defaultSession = pickDefaultSession(sessions);

        const allPeriods: PeriodeEvaluation[] = periodsData.success ? periodsData.data : [];

        // Groupes de l'année académique par défaut
        const groupsRes = await fetch(`/api/groups?session=${defaultSession}`);
        const groupsData = groupsRes.ok ? await groupsRes.json() : {};
        const groupsArray: YpareoGroup[] = groupsData ? Object.values(groupsData) : [];

        const campuses = buildCampuses(groupsArray, sitesArray);

        dispatch({ type: "INIT_DATA", sessions, sites: sitesArray, session: defaultSession, campuses, groups: groupsArray, periods: allPeriods });
      } catch (error: any) {
        dispatch({ type: "SHOW_ERROR", message: error.message || "Erreur chargement" });
        dispatch({ type: "INIT_DATA", sessions: [], sites: [], session: "", campuses: [], groups: [], periods: [] });
      }
    };
    fetchData();
  }, []);

  // Progress bar
  useEffect(() => {
    if (state.isLoading) {
      loadingIntervalRef.current = setInterval(() => {
        dispatch({ type: "SET_PROGRESS", progress: Math.min(state.progress + 2, 90) });
      }, 100);
      return () => { if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current); };
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      completeIntervalRef.current = setInterval(() => {
        if (state.progress >= 100) {
          clearInterval(completeIntervalRef.current!);
          setTimeout(() => dispatch({ type: "SET_LOADING_DONE" }), 300);
        } else {
          dispatch({ type: "SET_PROGRESS", progress: state.progress + 1 });
        }
      }, 20);
      return () => { if (completeIntervalRef.current) clearInterval(completeIntervalRef.current); };
    }
  }, [state.isLoading, state.progress]);

  // Changement d'année académique → reset des sélections + rechargement des groupes de cette année
  const handleSessionChange = useCallback(async (sessionCode: string) => {
    dispatch({ type: "SET_SESSION", session: sessionCode });
    try {
      const res = await fetch(`/api/groups?session=${sessionCode}`);
      const data = res.ok ? await res.json() : {};
      const groupsArray: YpareoGroup[] = data ? Object.values(data) : [];
      dispatch({ type: "SET_SESSION_GROUPS", campuses: buildCampuses(groupsArray, state.sites), groups: groupsArray });
    } catch {
      dispatch({ type: "SET_SESSION_GROUPS", campuses: [], groups: [] });
      dispatch({ type: "SHOW_ERROR", message: "Erreur lors du chargement des groupes de cette année académique." });
    }
  }, [state.sites]);

  const handleCampusChange = useCallback((campusId: string) => {
    const selectedCampus = state.campuses.find((c) => c.id === campusId);
    if (!selectedCampus) return dispatch({ type: "SET_CAMPUS", campus: campusId, groups: [] });
    const filtered = filterGroups(
      state.allGroups
        .filter((g) => g.codeSite === selectedCampus.codeSite)
        .map((g) => ({ id: g.codeGroupe, label: g.nomGroupe }))
        .sort((a, b) => a.label.localeCompare(b.label))
    );
    dispatch({ type: "SET_CAMPUS", campus: campusId, groups: filtered });
  }, [state.campuses, state.allGroups]);

  // Choix du groupe → charge les périodes du RÉFÉRENTIEL de ce groupe pour l'année choisie
  // (évite les périodes homonymes d'autres années qui donnaient des bulletins vides)
  const handleGroupChange = useCallback(async (groupId: string) => {
    dispatch({ type: "SET_GROUP", group: groupId });
    try {
      const res = await fetch(`/api/periods?group=${groupId}&session=${state.session}`);
      const json = res.ok ? await res.json() : { success: false };
      dispatch({ type: "SET_GROUP_PERIODS", periods: json.success ? json.data : [] });
    } catch {
      dispatch({ type: "SET_GROUP_PERIODS", periods: [] });
    }
  }, [state.session]);

  const SQL_STEPS = [
    "Connexion à YParéo...",
    "Récupération des apprenants...",
    "Récupération des notes et moyennes...",
    "Récupération des absences...",
    "Finalisation des données...",
  ];

  const PDF_STEPS = [
    "Données prêtes",
    "Génération des bulletins PDF...",
    "Création de l'archive ZIP...",
    "Finalisation...",
  ];

  const animateSteps = useCallback((
    steps: string[],
    durations: number[],
    dispatch: React.Dispatch<Action>
  ) => {
    const timers: NodeJS.Timeout[] = [];
    let elapsed = 0;

    steps.forEach((label, i) => {
      const t = setTimeout(() => {
        dispatch({
          type: "SET_OVERLAY_STEPS",
          steps: steps.map((l, j) => ({
            label: l,
            status: j < i ? "done" : j === i ? "current" : "todo",
          })),
        });
        dispatch({ type: "SET_OVERLAY_PROGRESS", progress: Math.round(((i + 1) / steps.length) * 90) });
      }, elapsed);
      timers.push(t);
      elapsed += durations[i] || 2000;
    });

    return () => timers.forEach(clearTimeout);
  }, []);

  // ✅ Flux unifié : 1 clic = récupération SQL → génération PDF → téléchargement auto
  const handleGenerate = useCallback(async () => {
    if (!state.session || !state.campus || !state.group || !state.semester) {
      return dispatch({ type: "SHOW_ERROR", message: "Veuillez remplir tous les champs." });
    }
    const selectedSession = state.sessions.find((s) => s.CODE_SESSION === state.session);
    const selectedCampus = state.campuses.find((c) => c.id === state.campus);
    const selectedPeriod =
      state.groupPeriods.find((p) => p.CODE_PERIODE_EVALUATION === state.semester) ||
      state.periods.find((p) => p.CODE_PERIODE_EVALUATION === state.semester);
    const selectedGroup = state.groups.find((g) => g.id.toString() === state.group);
    if (!selectedSession || !selectedCampus || !selectedPeriod || !selectedGroup) {
      return dispatch({ type: "SHOW_ERROR", message: "Sélection invalide." });
    }

    const coherenceError = checkCoherence(selectedGroup.label, selectedPeriod.NOM_PERIODE_EVALUATION);
    if (coherenceError) return dispatch({ type: "SHOW_ERROR", message: coherenceError });

    try {
      // ───────── PHASE 1 : récupération des données (SQL Ymag) ─────────
      dispatch({ type: "SET_SUBMITTING", value: true });
      dispatch({ type: "SET_OVERLAY_PROGRESS", progress: 0 });
      let cancelAnim = animateSteps(SQL_STEPS, [500, 2500, 3000, 3000, 2000], dispatch);

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);

      let sqlRes: Response;
      try {
        sqlRes = await fetch("/api/sql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            campus: selectedCampus.codeSite.toString(),
            group: state.group,
            session: Number(state.session),
            sessionDates: {
              DATE_DEB: selectedSession.DATE_DEB,
              DATE_FIN: selectedSession.DATE_FIN,
            },
            periodeEvaluationCode: state.semester,
            periodeEvaluation: selectedPeriod.NOM_PERIODE_EVALUATION,
            semester: state.semester,
            periodeEvaluationDates: {
              DATE_DEB: selectedPeriod.DATE_DEB,
              DATE_FIN: selectedPeriod.DATE_FIN,
              CODE_PERIODE_EVALUATION: selectedPeriod.CODE_PERIODE_EVALUATION,
              NOM_PERIODE_EVALUATION: selectedPeriod.NOM_PERIODE_EVALUATION,
            },
          }),
        });
      } finally {
        clearTimeout(timeout);
        cancelAnim();
      }

      const sqlJson = await sqlRes.json();
      if (!sqlRes.ok) throw new Error(sqlJson.error || "Erreur lors de la récupération des données.");

      const sqlData = sqlJson.data;
      const fromCache = !!sqlJson.fromCache;
      if (!sqlData?.APPRENANT?.length) {
        throw new Error("Aucun apprenant trouvé pour cette sélection.");
      }

      // ───────── PHASE 2 : génération des bulletins PDF ─────────
      dispatch({ type: "SET_SUBMITTING", value: false });
      dispatch({ type: "SET_GENERATING", value: true });
      dispatch({ type: "SET_OVERLAY_PROGRESS", progress: 0 });
      cancelAnim = animateSteps(PDF_STEPS, [300, 4000, 3000, 1500], dispatch);

      let pdfRes: Response;
      try {
        pdfRes = await fetch("/api/pdf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            data: sqlData,
            periodeEvaluation: selectedPeriod.NOM_PERIODE_EVALUATION,
            groupName: selectedGroup.label,
            periodeEvaluationDates: selectedPeriod,
            anneeScolaire: selectedSession.NOM_SESSION,
            sessionDates: {
              DATE_DEB: selectedSession.DATE_DEB,
              DATE_FIN: selectedSession.DATE_FIN,
            },
          }),
        });
      } finally {
        cancelAnim();
      }

      const pdfJson = await pdfRes.json();
      if (!pdfRes.ok) throw new Error(pdfJson.error || "Erreur lors de la génération des bulletins.");

      // Enregistrement en BDD — silencieux, ne bloque pas le téléchargement
      fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campus: selectedCampus.label,
          groupe: selectedGroup.label,
          periode: `${selectedPeriod.NOM_PERIODE_EVALUATION} (${selectedSession.NOM_SESSION})`,
          nbBulletins: pdfJson.studentCount,
        }),
      }).catch(() => {});

      dispatch({ type: "SET_OVERLAY_PROGRESS", progress: 100 });

      // ✅ Téléchargement automatique du ZIP
      try {
        await downloadZip(pdfJson.path, `bulletins_${selectedGroup.label.replace(/\s+/g, "_")}.zip`);
      } catch {
        // Si le navigateur bloque le téléchargement auto, le bouton de secours reste dispo dans la modale
      }

      dispatch({
        type: "PDF_SUCCESS",
        url: pdfJson.path,
        count: pdfJson.studentCount,
        fromCache,
        groupName: selectedGroup.label,
      });
    } catch (error: any) {
      const msg = error.name === "AbortError"
        ? "La requête a pris trop de temps (>45s). Veuillez réessayer."
        : error.message || "Une erreur est survenue.";
      dispatch({ type: "SHOW_ERROR", message: msg });
    } finally {
      dispatch({ type: "SET_SUBMITTING", value: false });
      dispatch({ type: "SET_GENERATING", value: false });
      dispatch({ type: "SET_OVERLAY_STEPS", steps: [] });
    }
  }, [state, animateSteps]);

  // Loading screen
  if (!state.isLoadingComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <div className="w-full max-w-xs space-y-3">
          <div className="relative w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#004976] transition-all duration-300 rounded-full"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-gray-400">Chargement des données... {state.progress}%</p>
        </div>
      </div>
    );
  }

  const selectedSessionObj = state.sessions.find((s) => s.CODE_SESSION === state.session);
  const selectedCampusLabel = state.campuses.find((c) => c.id === state.campus)?.label;
  const selectedGroupLabel = state.groups.find((g) => g.id.toString() === state.group)?.label;
  const selectedPeriodObj = state.periods.find((p) => p.CODE_PERIODE_EVALUATION === state.semester);
  // ✅ Filtre assoupli — garde toutes les périodes qui chevauchent l'année académique sélectionnée
  const sessionPeriods = selectedSessionObj
    ? state.periods.filter((p) => {
        const s = new Date(p.DATE_DEB);
        const e = new Date(p.DATE_FIN);
        return s <= new Date(selectedSessionObj.DATE_FIN) && e >= new Date(selectedSessionObj.DATE_DEB);
      })
    : [];
  // Périodes proposées : celles du référentiel du groupe en priorité, sinon repli sur le filtre par dates
  const displayedPeriods = state.groupPeriods.length > 0 ? state.groupPeriods : sessionPeriods;
  const isFormValid = !!state.session && !!state.campus && !!state.group && !!state.semester;

  return (
    <>
      {/* ── Overlay plein écran pendant SQL / PDF ── */}
      {(state.isSubmitting || state.isGeneratingPDF) && state.overlaySteps.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-7">
            <div className="flex items-center gap-3 mb-5">
              <Loader2 className="h-5 w-5 animate-spin text-[#004976] shrink-0" />
              <p className="text-sm font-medium text-gray-900">
                {state.isSubmitting ? "Récupération des données…" : "Génération des bulletins…"}
              </p>
            </div>

            {/* Étapes */}
            <div className="space-y-3 mb-5">
              {state.overlaySteps.map((s, i) => (
                <div key={i} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-xs font-bold transition-all ${
                    s.status === "done"    ? "bg-[#004976] text-white" :
                    s.status === "current" ? "bg-[#e6edf4] text-[#004976] ring-2 ring-[#004976]/30" :
                                            "bg-gray-100 text-gray-300"
                  }`}>
                    {s.status === "done" ? "✓" : i + 1}
                  </div>
                  <span className={`text-sm transition-colors ${
                    s.status === "done"    ? "text-gray-400 line-through" :
                    s.status === "current" ? "text-gray-900 font-medium" :
                                            "text-gray-300"
                  }`}>
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Barre de progression */}
            <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#004976] rounded-full transition-all duration-700"
                style={{ width: `${state.overlayProgress}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Cette opération peut prendre jusqu'à 25 secondes
            </p>
          </div>
        </div>
      )}

      <div className="min-h-screen flex bg-gray-50">

        {/* Sidebar */}
        <aside
          className="w-72 bg-[#002a44] bg-cover bg-center flex flex-col py-8 px-5 shrink-0 min-h-screen"
          style={{ backgroundImage: "linear-gradient(rgba(0,42,68,0.88), rgba(0,42,68,0.88)), url('/images/espi-motif-bleu.png')" }}
        >
          {/* Back */}
          <Link
            href="/home"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-8 transition-colors w-fit"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Tableau de bord
          </Link>

          <div className="mb-8">
            <h2 className="text-white font-medium text-base font-serif">Génération de bulletins</h2>
            <p className="text-white/40 text-xs mt-1">Suivez les étapes ci-dessous</p>
          </div>

          {/* Étapes */}
          <div className="flex flex-col gap-5">
            <StepIndicator step={1} label="Sélection du campus" status={currentStep > 1 ? "done" : currentStep === 1 ? "current" : "todo"} />
            <StepIndicator step={2} label="Sélection du groupe" status={currentStep > 2 ? "done" : currentStep === 2 ? "current" : "todo"} />
            <StepIndicator step={3} label="Période d'évaluation" status={currentStep > 3 ? "done" : currentStep === 3 ? "current" : "todo"} />
            <StepIndicator step={4} label="Génération des PDF" status={currentStep === 4 ? "current" : "todo"} />
          </div>

          {/* Récapitulatif */}
          {(selectedCampusLabel || selectedGroupLabel) && (
            <div className="mt-auto bg-white/5 border border-white/10 rounded-xl p-4 space-y-3">
              {selectedSessionObj && (
                <div>
                  <div className="text-white/40 text-xs">Année académique</div>
                  <div className="text-white text-sm font-medium mt-0.5">{selectedSessionObj.NOM_SESSION}</div>
                </div>
              )}
              {selectedCampusLabel && (
                <div>
                  <div className="text-white/40 text-xs">Campus</div>
                  <div className="text-white text-sm font-medium mt-0.5">{selectedCampusLabel}</div>
                </div>
              )}
              {selectedGroupLabel && (
                <div>
                  <div className="text-white/40 text-xs">Groupe</div>
                  <div className="text-white text-sm font-medium mt-0.5">{selectedGroupLabel}</div>
                </div>
              )}
              {selectedPeriodObj && (
                <div>
                  <div className="text-white/40 text-xs">Période</div>
                  <div className="text-white text-sm font-medium mt-0.5">{selectedPeriodObj.NOM_PERIODE_EVALUATION}</div>
                </div>
              )}
            </div>
          )}
        </aside>

        {/* Contenu principal */}
        <div className="flex-1 flex items-start justify-center p-8 pt-16">
          <div className="w-full max-w-md">

            {/* Progress bar */}
            <div className="w-full h-0.5 bg-gray-200 rounded-full mb-8 overflow-hidden">
              <div
                className="h-full bg-[#004976] rounded-full transition-all duration-500"
                style={{ width: `${Math.round(((currentStep - 1) / 3) * 100)}%` }}
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
              <div className="mb-6">
                <h1 className="text-lg font-medium text-gray-900 font-serif">Choisir les bulletins à éditer</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {session?.user?.name ? `Bonjour ${session.user.name} —` : ""} Remplissez les champs ci-dessous
                </p>
              </div>

              <div className="space-y-5">
                {/* Année académique */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Année académique</label>
                  <Select value={state.session} onValueChange={handleSessionChange}>
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#004976] focus:ring-[#004976] text-sm">
                      <SelectValue placeholder="Sélectionnez une année" />
                    </SelectTrigger>
                    <SelectContent>
                      {state.sessions.map((s) => (
                        <SelectItem key={s.CODE_SESSION} value={s.CODE_SESSION}>{s.NOM_SESSION}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Campus */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Campus</label>
                  <Select value={state.campus} onValueChange={handleCampusChange} disabled={!state.session || state.isLoadingGroups}>
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#004976] focus:ring-[#004976] text-sm disabled:opacity-50">
                      <SelectValue placeholder={state.isLoadingGroups ? "Chargement des groupes…" : "Sélectionnez un campus"} />
                    </SelectTrigger>
                    <SelectContent>
                      {[...state.campuses]
                        .sort((a, b) => a.label.localeCompare(b.label))
                        .map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Groupe */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Groupe</label>
                  <Select
                    value={state.group}
                    onValueChange={handleGroupChange}
                    disabled={!state.campus}
                  >
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#004976] focus:ring-[#004976] text-sm disabled:opacity-50">
                      <SelectValue placeholder={!state.campus ? "Choisissez d'abord un campus" : "Sélectionnez un groupe"} />
                    </SelectTrigger>
                    <SelectContent>
                      {state.groups.map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>{g.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Période */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Période d'évaluation</label>
                  <Select
                    value={state.semester}
                    onValueChange={(v) => dispatch({ type: "SET_SEMESTER", semester: v })}
                    disabled={!state.group || state.isLoadingPeriods}
                  >
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#004976] focus:ring-[#004976] text-sm disabled:opacity-50">
                      <SelectValue placeholder={state.isLoadingPeriods ? "Chargement des périodes…" : "Sélectionnez une période"} />
                    </SelectTrigger>
                    <SelectContent>
                      {[...displayedPeriods]
                        .filter((p) => !p.NOM_PERIODE_EVALUATION.startsWith("BTS"))
                        .sort((a, b) => a.NOM_PERIODE_EVALUATION.localeCompare(b.NOM_PERIODE_EVALUATION))
                        .map((p) => (
                          <SelectItem key={p.CODE_PERIODE_EVALUATION} value={p.CODE_PERIODE_EVALUATION}>
                            {p.NOM_PERIODE_EVALUATION}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Génération — flux unifié en 1 clic */}
                <Button
                  onClick={handleGenerate}
                  disabled={!isFormValid || state.isSubmitting || state.isGeneratingPDF}
                  className="w-full h-10 bg-[#004976] hover:bg-[#003757] text-white font-medium text-sm disabled:opacity-40 transition-all mt-2"
                >
                  {state.isSubmitting || state.isGeneratingPDF ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Génération en cours…</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" />Générer les bulletins</>
                  )}
                </Button>

                <p className="text-xs text-center text-gray-400 pt-1">
                  Récupération des données et création des PDF en une seule étape.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal — PDF prêt */}
      <Dialog open={state.modal === "pdfSuccess"} onOpenChange={() => dispatch({ type: "CLOSE_MODAL" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" /> Bulletins générés
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-gray-900">{state.pdfStudentCount} bulletin{state.pdfStudentCount > 1 ? "s" : ""}</span>{" "}
              généré{state.pdfStudentCount > 1 ? "s" : ""} pour{" "}
              <span className="font-medium text-gray-900">{state.selectedGroupName}</span>.
              <br />Le téléchargement a démarré automatiquement.
            </DialogDescription>
          </DialogHeader>

          {/* Bandeau d'avertissement si données issues du cache (Ymag KO) */}
          {state.pdfFromCache && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              <span className="text-sm leading-none mt-0.5">⚠️</span>
              <span>
                YParéo était momentanément indisponible : ces bulletins ont été générés à partir des{" "}
                <span className="font-semibold">dernières données enregistrées</span>. Vérifiez qu'elles sont à jour.
              </span>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              onClick={async () => {
                try {
                  await downloadZip(state.pdfDownloadUrl, `bulletins_${state.selectedGroupName.replace(/\s+/g, "_")}.zip`);
                } catch {
                  dispatch({ type: "SHOW_ERROR", message: "Erreur lors du téléchargement." });
                }
              }}
              className="bg-[#004976] hover:bg-[#003757]"
            >
              <FileDown className="mr-2 h-4 w-4" /> Re-télécharger le ZIP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — Erreur */}
      <Dialog open={state.modal === "error"} onOpenChange={() => dispatch({ type: "CLOSE_MODAL" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-5 h-5" /> Erreur
            </DialogTitle>
            <DialogDescription>{state.errorMessage}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => dispatch({ type: "CLOSE_MODAL" })}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}