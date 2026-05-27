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
  campuses: Campus[];
  allGroups: YpareoGroup[];
  groups: Group[];
  periods: PeriodeEvaluation[];
  campus: string;
  group: string;
  semester: string;
  isLoading: boolean;
  isSubmitting: boolean;
  isGeneratingPDF: boolean;
  progress: number;
  isLoadingComplete: boolean;
  modal: Modal;
  errorMessage: string;
  retrievedData: any;
  pdfDownloadUrl: string;
  pdfStudentCount: number;
  selectedGroupName: string;
}

const initialState: State = {
  campuses: [], allGroups: [], groups: [], periods: [],
  campus: "", group: "", semester: "",
  isLoading: true, isSubmitting: false, isGeneratingPDF: false,
  progress: 0, isLoadingComplete: false,
  modal: "none", errorMessage: "",
  retrievedData: null, pdfDownloadUrl: "", pdfStudentCount: 0, selectedGroupName: "",
};

type Action =
  | { type: "INIT_DATA"; campuses: Campus[]; groups: YpareoGroup[]; periods: PeriodeEvaluation[] }
  | { type: "SET_CAMPUS"; campus: string; groups: Group[] }
  | { type: "SET_GROUP"; group: string }
  | { type: "SET_SEMESTER"; semester: string }
  | { type: "SET_LOADING_DONE" }
  | { type: "SET_PROGRESS"; progress: number }
  | { type: "SET_SUBMITTING"; value: boolean }
  | { type: "SET_GENERATING"; value: boolean }
  | { type: "SQL_SUCCESS"; data: any; groupName: string }
  | { type: "PDF_SUCCESS"; url: string; count: number }
  | { type: "SHOW_ERROR"; message: string }
  | { type: "CLOSE_MODAL" };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "INIT_DATA": return { ...state, campuses: action.campuses, allGroups: action.groups, periods: action.periods, isLoading: false };
    case "SET_CAMPUS": return { ...state, campus: action.campus, groups: action.groups, group: "", semester: "" };
    case "SET_GROUP": return { ...state, group: action.group };
    case "SET_SEMESTER": return { ...state, semester: action.semester };
    case "SET_LOADING_DONE": return { ...state, isLoadingComplete: true };
    case "SET_PROGRESS": return { ...state, progress: action.progress };
    case "SET_SUBMITTING": return { ...state, isSubmitting: action.value };
    case "SET_GENERATING": return { ...state, isGeneratingPDF: action.value };
    case "SQL_SUCCESS": return { ...state, retrievedData: action.data, selectedGroupName: action.groupName, modal: "success" };
    case "PDF_SUCCESS": return { ...state, pdfDownloadUrl: action.url, pdfStudentCount: action.count, modal: "pdfSuccess" };
    case "SHOW_ERROR": return { ...state, errorMessage: action.message, modal: "error" };
    case "CLOSE_MODAL": return { ...state, modal: "none" };
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
        status === "done" ? "bg-[#156082] text-white" :
        status === "current" ? "bg-white text-[#003349] font-semibold" :
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
        const [periodsRes, groupsRes] = await Promise.all([
          fetch("/api/periods"),
          fetch("/api/groups"),
        ]);
        if (!periodsRes.ok || !groupsRes.ok) throw new Error("Erreur chargement données");

        const [periodsData, groupsData] = await Promise.all([
          periodsRes.json(),
          groupsRes.json(),
        ]);

        const startDate = new Date("2025-08-25");
        const endDate = new Date("2026-08-23");
        // ✅ Filtre assoupli — garde toutes les périodes qui chevauchent l'année scolaire
        const filteredPeriods: PeriodeEvaluation[] = periodsData.success
          ? periodsData.data.filter((p: PeriodeEvaluation) => {
              const s = new Date(p.DATE_DEB);
              const e = new Date(p.DATE_FIN);
              return s <= endDate && e >= startDate;
            })
          : [];

        const groupsArray: YpareoGroup[] = groupsData ? Object.values(groupsData) : [];

        const sitesRes = await fetch("/api/students");
        const sitesRaw = sitesRes.ok ? await sitesRes.json() : [];
        const sitesArray: { CODE_SITE: number; NOM_SITE: string }[] = Array.isArray(sitesRaw) ? sitesRaw : Object.values(sitesRaw);
        const siteNameMap = new Map<number, string>(sitesArray.map((s) => [Number(s.CODE_SITE), s.NOM_SITE]));

        const uniqueCodeSites = [...new Set(groupsArray.map((g) => g.codeSite).filter(Boolean))];
        const campuses: Campus[] = uniqueCodeSites
          .map((codeSite, i) => ({ id: `campus-${codeSite}-${i}`, codeSite, label: siteNameMap.get(codeSite) ?? `Campus ${codeSite}` }))
          .filter((c) => c.label !== "GROUPE ESPI");

        dispatch({ type: "INIT_DATA", campuses, groups: groupsArray, periods: filteredPeriods });
      } catch (error: any) {
        dispatch({ type: "SHOW_ERROR", message: error.message || "Erreur chargement" });
        dispatch({ type: "INIT_DATA", campuses: [], groups: [], periods: [] });
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

  const handleSubmit = useCallback(async () => {
    if (!state.campus || !state.group || !state.semester) {
      return dispatch({ type: "SHOW_ERROR", message: "Veuillez remplir tous les champs." });
    }
    const selectedCampus = state.campuses.find((c) => c.id === state.campus);
    const selectedPeriod = state.periods.find((p) => p.CODE_PERIODE_EVALUATION === state.semester);
    const selectedGroup = state.groups.find((g) => g.id.toString() === state.group);
    if (!selectedCampus || !selectedPeriod || !selectedGroup) return dispatch({ type: "SHOW_ERROR", message: "Sélection invalide." });

    const coherenceError = checkCoherence(selectedGroup.label, selectedPeriod.NOM_PERIODE_EVALUATION);
    if (coherenceError) return dispatch({ type: "SHOW_ERROR", message: coherenceError });

    try {
      dispatch({ type: "SET_SUBMITTING", value: true });
      const response = await fetch("/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campus: selectedCampus.codeSite.toString(),
          group: state.group,
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
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      retrievedDataRef.current = data.data;
      dispatch({ type: "SQL_SUCCESS", data: data.data, groupName: selectedGroup.label });
    } catch (error: any) {
      dispatch({ type: "SHOW_ERROR", message: error.message || "Erreur lors de la récupération des données." });
    } finally {
      dispatch({ type: "SET_SUBMITTING", value: false });
    }
  }, [state]);

  const handleGeneratePDFs = useCallback(async () => {
    const dataToUse = retrievedDataRef.current || state.retrievedData;
    if (!dataToUse?.APPRENANT?.length) return dispatch({ type: "SHOW_ERROR", message: "Données insuffisantes." });
    const selectedPeriod = state.periods.find((p) => p.CODE_PERIODE_EVALUATION === state.semester);
    const selectedCampus = state.campuses.find((c) => c.id === state.campus);
    try {
      dispatch({ type: "SET_GENERATING", value: true });
      dispatch({ type: "CLOSE_MODAL" });
      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataToUse,
          periodeEvaluation: selectedPeriod?.NOM_PERIODE_EVALUATION,
          groupName: state.selectedGroupName,
          periodeEvaluationDates: selectedPeriod || null,
        }),
      });
      if (!response.ok) throw new Error("Erreur génération PDF");
      const data = await response.json();
      retrievedDataRef.current = null;

      // ✅ Enregistrement de la génération en BDD
      await fetch("/api/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campus: selectedCampus?.label ?? "",
          groupe: state.selectedGroupName,
          periode: selectedPeriod?.NOM_PERIODE_EVALUATION ?? "",
          nbBulletins: data.studentCount,
        }),
      }).catch(() => {}); // silencieux — ne bloque pas le téléchargement

      dispatch({ type: "PDF_SUCCESS", url: data.path, count: data.studentCount });
    } catch (error: any) {
      dispatch({ type: "SHOW_ERROR", message: error.message });
    } finally {
      dispatch({ type: "SET_GENERATING", value: false });
    }
  }, [state]);

  // Loading screen
  if (!state.isLoadingComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 px-4">
        <div className="w-full max-w-xs space-y-3">
          <div className="relative w-full h-1 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-[#156082] transition-all duration-300 rounded-full"
              style={{ width: `${state.progress}%` }}
            />
          </div>
          <p className="text-xs text-center text-gray-400">Chargement des données... {state.progress}%</p>
        </div>
      </div>
    );
  }

  const selectedCampusLabel = state.campuses.find((c) => c.id === state.campus)?.label;
  const selectedGroupLabel = state.groups.find((g) => g.id.toString() === state.group)?.label;
  const selectedPeriodObj = state.periods.find((p) => p.CODE_PERIODE_EVALUATION === state.semester);
  const isFormValid = !!state.campus && !!state.group && !!state.semester;

  return (
    <>
      <div className="min-h-screen flex bg-gray-50">

        {/* Sidebar */}
        <aside className="w-72 bg-[#003349] flex flex-col py-8 px-5 shrink-0 min-h-screen">
          {/* Back */}
          <Link
            href="/home"
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-xs mb-8 transition-colors w-fit"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Tableau de bord
          </Link>

          <div className="mb-8">
            <h2 className="text-white font-medium text-base">Génération de bulletins</h2>
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
                className="h-full bg-[#156082] rounded-full transition-all duration-500"
                style={{ width: `${Math.round(((currentStep - 1) / 3) * 100)}%` }}
              />
            </div>

            <div className="bg-white border border-gray-100 rounded-2xl p-8 shadow-sm">
              <div className="mb-6">
                <h1 className="text-lg font-medium text-gray-900">Choisir les bulletins à éditer</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {session?.user?.name ? `Bonjour ${session.user.name} —` : ""} Remplissez les champs ci-dessous
                </p>
              </div>

              <div className="space-y-5">
                {/* Campus */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-600 uppercase tracking-wide">Campus</label>
                  <Select value={state.campus} onValueChange={handleCampusChange}>
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#156082] focus:ring-[#156082] text-sm">
                      <SelectValue placeholder="Sélectionnez un campus" />
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
                    onValueChange={(v) => dispatch({ type: "SET_GROUP", group: v })}
                    disabled={!state.campus}
                  >
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#156082] focus:ring-[#156082] text-sm disabled:opacity-50">
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
                    disabled={!state.group}
                  >
                    <SelectTrigger className="h-10 border-gray-200 focus:border-[#156082] focus:ring-[#156082] text-sm disabled:opacity-50">
                      <SelectValue placeholder="Sélectionnez une période" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...state.periods]
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

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={!isFormValid || state.isSubmitting}
                  className="w-full h-10 bg-[#156082] hover:bg-[#124f6b] text-white font-medium text-sm disabled:opacity-40 transition-all mt-2"
                >
                  {state.isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" />Chargement...</>
                  ) : (
                    <><FileText className="w-4 h-4 mr-2" />Confirmer mon choix</>
                  )}
                </Button>

                {/* Génération en cours */}
                {state.isGeneratingPDF && (
                  <div className="flex items-center justify-center gap-2 text-xs text-[#156082] py-1">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Génération des bulletins en cours...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal — Succès données */}
      <Dialog open={state.modal === "success"} onOpenChange={() => dispatch({ type: "CLOSE_MODAL" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" /> Données récupérées
            </DialogTitle>
            <DialogDescription>
              Données prêtes pour{" "}
              <span className="font-medium text-gray-900">{state.selectedGroupName}</span>
              {selectedPeriodObj && <> — <span className="font-medium text-gray-900">{selectedPeriodObj.NOM_PERIODE_EVALUATION}</span></>}.
              <br />Vous pouvez générer les bulletins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => dispatch({ type: "CLOSE_MODAL" })}>Fermer</Button>
            <Button onClick={handleGeneratePDFs} disabled={state.isGeneratingPDF} className="bg-[#156082] hover:bg-[#124f6b]">
              {state.isGeneratingPDF ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Génération...</> : <><FileText className="w-4 h-4 mr-2" />Générer les PDF</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal — PDF prêt */}
      <Dialog open={state.modal === "pdfSuccess"} onOpenChange={() => dispatch({ type: "CLOSE_MODAL" })}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-5 h-5" /> Bulletins générés
            </DialogTitle>
            <DialogDescription>
              <span className="font-medium text-gray-900">{state.pdfStudentCount} bulletin{state.pdfStudentCount > 1 ? "s" : ""}</span>{" "}
              prêt{state.pdfStudentCount > 1 ? "s" : ""} dans l'archive ZIP.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-2">
            <Button
              onClick={async () => {
                try {
                  await downloadZip(state.pdfDownloadUrl, `bulletins_${state.selectedGroupName.replace(/\s+/g, "_")}.zip`);
                } catch {
                  dispatch({ type: "SHOW_ERROR", message: "Erreur lors du téléchargement." });
                }
              }}
              className="bg-[#156082] hover:bg-[#124f6b]"
            >
              <FileDown className="mr-2 h-4 w-4" /> Télécharger le ZIP
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