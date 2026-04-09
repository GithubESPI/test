/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, FileDown, FileText, Loader2, School, XCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

const formSchema = z.object({
  name: z.string().optional(),
  campus: z.string().min(1, "Veuillez sélectionner un campus"),
  group: z.string().min(1, "Veuillez sélectionner un groupe"),
  semester: z.string().min(1, "Veuillez sélectionner une période"),
  periodeEvaluationCode: z.string().optional(),
  periodeEvaluation: z.string().optional(),
});

type FormValues = z.infer<typeof formSchema>;

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

// ✅ SUPPRIMÉ : interface YpareoStudent — plus utilisée

interface Campus {
  id: string;
  codeSite: number;
  label: string;
}

interface Group {
  id: number;
  label: string;
}

export default function Home() {
  const { data: session } = useSession();
  const [campuses, setCampuses] = useState<Campus[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [periods, setPeriods] = useState<PeriodeEvaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [allGroups, setAllGroups] = useState<YpareoGroup[]>([]);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showPdfSuccessModal, setShowPdfSuccessModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [retrievedData, setRetrievedData] = useState<any>(null);
  const [pdfDownloadUrl, setPdfDownloadUrl] = useState<string>("");
  const [pdfStudentCount, setPdfStudentCount] = useState<number>(0);
  const [selectedGroupName, setSelectedGroupName] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);

  const responseDataRef = useRef<any>(null);
  const loadingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const completeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      campus: "",
      group: "",
      semester: "",
      periodeEvaluationCode: "",
      periodeEvaluation: "",
    },
  });

  useEffect(() => {
    if (!session?.user?.email) return;
    fetch(`/api/user?email=${encodeURIComponent(session.user.email)}`)
      .then((r) => r.json())
      .then((data) => { if (data?.name) form.setValue("name", data.name); })
      .catch(console.error);
  }, [session?.user?.email]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // ✅ CORRECTION : /api/students supprimé — c'était lui les 36 Mo
        // On charge uniquement périodes + groupes (2 appels au lieu de 3)
        // Les campus sont extraits depuis groupsData qui contient déjà codeSite,
        // enrichi avec nomSite via /api/students qui appelle désormais le requêteur SQL
        const [periodsResponse, groupsResponse] = await Promise.all([
          fetch("/api/periods"),
          fetch("/api/groups"),
        ]);

        if (!periodsResponse.ok) throw new Error("Erreur périodes");
        if (!groupsResponse.ok) throw new Error("Erreur groupes");

        const [periodsData, groupsData] = await Promise.all([
          periodsResponse.json(),
          groupsResponse.json(),
        ]);

        // Périodes — inchangé
        if (periodsData.success && Array.isArray(periodsData.data)) {
          const startDate = new Date("2025-08-25 00:00:00");
          const endDate = new Date("2026-08-23 00:00:00");
          const filteredPeriods = periodsData.data.filter((period: PeriodeEvaluation) => {
            const periodStartDate = new Date(period.DATE_DEB);
            const periodEndDate = new Date(period.DATE_FIN);
            return (
              (periodStartDate.getTime() === startDate.getTime() &&
                periodEndDate.getTime() === endDate.getTime()) ||
              (periodStartDate >= startDate && periodEndDate <= endDate)
            );
          });
          setPeriods(filteredPeriods);
        }

        // Groupes — inchangé
        const groupsArray = groupsData
          ? (Object.values(groupsData) as YpareoGroup[])
          : [];
        setAllGroups(groupsArray);

        // ✅ Campus extraits depuis les groupes (codeSite déjà présent)
        // + nomSite récupéré via /api/students (requêteur SQL léger)
        // On dédoublonne par codeSite, puis on appelle /api/students
        // uniquement pour enrichir avec le nom — ~2 Ko au lieu de 36 Mo
        const uniqueCodeSites = [...new Set(groupsArray.map((g) => g.codeSite).filter(Boolean))];

        // Récupération des noms de campus via le requêteur SQL
        const sitesResponse = await fetch("/api/students");
        const sitesData = sitesResponse.ok ? await sitesResponse.json() : [];
        const sitesArray: { CODE_SITE: number; NOM_SITE: string }[] = Array.isArray(sitesData)
          ? sitesData
          : Object.values(sitesData);

        // Map codeSite → nomSite
        const siteNameMap = new Map<number, string>();
        sitesArray.forEach((site) => {
          siteNameMap.set(Number(site.CODE_SITE), site.NOM_SITE);
        });

        // Construction de la liste des campus
        const uniqueCampuses: Campus[] = uniqueCodeSites
          .map((codeSite, index) => ({
            id: `campus-${codeSite}-${index}`,
            codeSite: codeSite,
            label: siteNameMap.get(codeSite) ?? `Campus ${codeSite}`,
          }))
          .filter((c) => c.label !== "GROUPE ESPI");

        setCampuses(uniqueCampuses);

      } catch (error) {
        console.error(error);
        setErrorMessage("Erreur lors du chargement des données");
        setShowErrorModal(true);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Progress bar — inchangé
  useEffect(() => {
    if (isLoading) {
      setIsLoadingComplete(false);
      setProgress(0);
      loadingIntervalRef.current = setInterval(() => {
        setProgress((prev) => (prev >= 90 ? 90 : prev + 2));
      }, 100);
      return () => {
        if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      };
    } else {
      if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
      completeIntervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            if (completeIntervalRef.current) clearInterval(completeIntervalRef.current);
            setTimeout(() => setIsLoadingComplete(true), 300);
            return 100;
          }
          return prev + 1;
        });
      }, 20);
      return () => {
        if (completeIntervalRef.current) clearInterval(completeIntervalRef.current);
      };
    }
  }, [isLoading]);

  const updateGroups = (campusId: string) => {
    const selectedCampus = campuses.find((campus) => campus.id === campusId);
    if (!selectedCampus) {
      setGroups([]);
      return;
    }
    const filteredGroups = allGroups
      .filter((group) => group.codeSite === selectedCampus.codeSite)
      .map((group) => ({ id: group.codeGroupe, label: group.nomGroupe }));
    setGroups(filteredGroups);
    form.setValue("group", "");
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);
      const selectedCampus = campuses.find((campus) => campus.id === values.campus);
      if (!selectedCampus) throw new Error("Campus non trouvé");

      const selectedPeriod = periods.find((p) => p.CODE_PERIODE_EVALUATION === values.semester);
      if (!selectedPeriod) throw new Error("Période non trouvée");

      values.periodeEvaluationCode = values.semester;
      values.periodeEvaluation = selectedPeriod.NOM_PERIODE_EVALUATION;

      const selectedGroup = groups.find((group) => group.id.toString() === values.group);
      if (selectedGroup) setSelectedGroupName(selectedGroup.label);

      const groupName = selectedGroup?.label.toUpperCase() || "";
      const periodName = selectedPeriod.NOM_PERIODE_EVALUATION.toUpperCase();
      if (groupName.includes("ALT") && periodName.includes("TP")) {
        throw new Error(`Incohérence : Groupe Alternance avec période Temps Plein.`);
      }
      if (groupName.includes("TP") && periodName.includes("ALT")) {
        throw new Error(`Incohérence : Groupe Temps Plein avec période Alternance.`);
      }

      // /api/sql — appelé UNIQUEMENT après confirmation, inchangé
      const response = await fetch("/api/sql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campus: selectedCampus.codeSite.toString(),
          group: values.group,
          periodeEvaluationCode: values.periodeEvaluationCode,
          periodeEvaluation: values.periodeEvaluation,
          semester: values.semester,
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

      responseDataRef.current = data.data;
      setRetrievedData(data.data);
      setShowSuccessModal(true);
    } catch (error: any) {
      setErrorMessage(error.message || "Une erreur est survenue");
      setShowErrorModal(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGeneratePDFs = async () => {
    const dataToUse = responseDataRef.current || retrievedData;
    if (!dataToUse || !dataToUse.APPRENANT?.length) {
      setErrorMessage("Données insuffisantes pour générer les PDFs.");
      setShowErrorModal(true);
      return;
    }
    try {
      setIsGeneratingPDF(true);
      const selectedPeriodCode = form.getValues("semester");
      const periodWithDates = periods.find((p) => p.CODE_PERIODE_EVALUATION === selectedPeriodCode);

      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataToUse,
          periodeEvaluation: form.getValues("periodeEvaluation"),
          groupName: selectedGroupName,
          periodeEvaluationDates: periodWithDates || null,
        }),
      });

      if (!response.ok) throw new Error("Erreur génération PDF");
      const data = await response.json();
      setPdfDownloadUrl(data.path);
      setPdfStudentCount(data.studentCount);
      setShowPdfSuccessModal(true);
    } catch (error: any) {
      setErrorMessage(error.message);
      setShowErrorModal(true);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  if (!isLoadingComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 px-4">
        <div className="w-full max-w-md">
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#156082] to-[#003349] transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-center text-gray-600 mt-4">Chargement... {progress}%</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-3">
        <Card className="w-full max-w-lg shadow-none">
          <CardHeader className="pb-4 px-8 text-center">
            <div className="flex justify-center mb-2">
              <div className="bg-gradient-to-r from-[#156082] to-[#003349] rounded-full p-3">
                <School className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-[#156082] to-[#003349] bg-clip-text text-transparent">
              Choisir les bulletins à éditer
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="campus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Campus</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          updateGroups(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 border-2 focus:border-[#156082]">
                            <SelectValue placeholder="Sélectionnez un campus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {campuses
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Groupe</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || ""}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 border-2 focus:border-[#156082]">
                            <SelectValue placeholder={groups.length === 0 ? "Choisissez d'abord un campus" : "Sélectionnez un groupe"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups.length > 0 ? (
                            groups
                              .filter((group) => {
                                const prefixesToExclude = ["P-BTS1", "P-BTS2", "M-BTS1", "M-BTS2", "N-BTS1", "N-BTS2", "L-BTS1", "LI-BTS1", "LI-BTS2", "B-BTS1", "MP-BTS1", "MP-BTS2", "B-BTS2"];
                                const startsWithExcludedPrefix = prefixesToExclude.some((prefix) => group.label.startsWith(prefix));
                                const containsExcludedTerm = group.label.includes("Césure") || group.label.includes("RP") || group.label.includes("DDS");
                                return !startsWithExcludedPrefix && !containsExcludedTerm;
                              })
                              .sort((a, b) => a.label.localeCompare(b.label))
                              .map((group) => (
                                <SelectItem key={group.id} value={group.id.toString()}>
                                  {group.label}
                                </SelectItem>
                              ))
                          ) : (
                            <div className="p-2 text-sm text-gray-500">Sélectionner d'abord un campus pour choisir un groupe</div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="semester"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Période d'évaluation</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const selected = periods.find((p) => p.CODE_PERIODE_EVALUATION === value);
                          if (selected) {
                            form.setValue("periodeEvaluationCode", value);
                            form.setValue("periodeEvaluation", selected.NOM_PERIODE_EVALUATION);
                          }
                          field.onChange(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 border-2 focus:border-[#156082]">
                            <SelectValue placeholder="Sélectionnez une période" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {periods
                            .filter((p) => !p.NOM_PERIODE_EVALUATION.startsWith("BTS"))
                            .sort((a, b) => a.NOM_PERIODE_EVALUATION.localeCompare(b.NOM_PERIODE_EVALUATION))
                            .map((p) => (
                              <SelectItem key={p.CODE_PERIODE_EVALUATION} value={p.CODE_PERIODE_EVALUATION}>
                                {p.NOM_PERIODE_EVALUATION}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-10 font-bold bg-gradient-to-r from-[#156082] to-[#003349] hover:opacity-90 transition-all"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
                  {isSubmitting ? "Chargement..." : "Confirmer mon choix"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" /> Succès
            </DialogTitle>
            <DialogDescription>
              Données récupérées. Vous pouvez générer les bulletins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3 pt-4">
            <Button onClick={() => setShowSuccessModal(false)} variant="outline">Fermer</Button>
            <Button onClick={handleGeneratePDFs} disabled={isGeneratingPDF} className="bg-gradient-to-r from-[#156082] to-[#003349]">
              {isGeneratingPDF ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="w-4 h-4 mr-2" />}
              Générer les PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showPdfSuccessModal} onOpenChange={setShowPdfSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-green-600 flex items-center gap-2">
              <CheckCircle2 /> Terminée
            </DialogTitle>
            <DialogDescription>
              {pdfStudentCount} bulletins prêts dans l'archive.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={async () => {
                try {
                  const response = await fetch(pdfDownloadUrl);
                  if (!response.ok) throw new Error("Erreur téléchargement");
                  const blob = await response.blob();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `bulletins_${selectedGroupName.replace(/\s+/g, "_")}.zip`;
                  a.click();
                  setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (error) {
                  setErrorMessage("Erreur lors du téléchargement");
                  setShowErrorModal(true);
                }
              }}
              className="bg-gradient-to-r from-[#156082] to-[#003349]"
            >
              <FileDown className="mr-2" /> Télécharger
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-600 flex items-center gap-2">
              <XCircle /> Erreur
            </DialogTitle>
            <DialogDescription>{errorMessage}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}