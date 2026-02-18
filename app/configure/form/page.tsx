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

interface YpareoStudent {
  inscriptions: Array<{
    site: {
      codeSite: number;
      nomSite: string;
    };
    codeGroupe: number | null;
  }>;
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

const EXCLUDED_PREFIXES = [
  "P-BTS1", "P-BTS2", "M-BTS1", "M-BTS2", "N-BTS1", "N-BTS2",
  "L-BTS1", "LI-BTS1", "LI-BTS2", "B-BTS1", "MP-BTS1", "MP-BTS2", "B-BTS2",
];

const PERIOD_START = new Date("2025-08-25 00:00:00");
const PERIOD_END = new Date("2026-08-23 00:00:00");

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

  const responseDataRef = useRef<any>(null);

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

  // Récupération du nom utilisateur
  useEffect(() => {
    if (!session?.user?.email) return;

    const getUserData = async () => {
      try {
        const response = await fetch(`/api/user?email=${encodeURIComponent(session.user!.email!)}`);
        const data = await response.json();
        if (data?.name) form.setValue("name", data.name);
      } catch (error) {
        console.error("Erreur récupération nom utilisateur:", error);
      }
    };

    getUserData();
  }, [session, form]);

  // ✅ Chargement initial avec fetch parallèle
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // ✅ Les 3 appels API en parallèle au lieu de séquentiels
        const [periodsResponse, studentsResponse, groupsResponse] = await Promise.all([
          fetch("/api/periods"),
          fetch("/api/students"),
          fetch("/api/groups"),
        ]);

        if (!periodsResponse.ok) throw new Error("Erreur récupération périodes");
        if (!studentsResponse.ok) throw new Error("Erreur récupération étudiants");
        if (!groupsResponse.ok) throw new Error("Erreur récupération groupes");

        const [periodsData, studentsData, groupsData] = await Promise.all([
          periodsResponse.json(),
          studentsResponse.json(),
          groupsResponse.json(),
        ]);

        // Filtrage des périodes
        if (periodsData.success && Array.isArray(periodsData.data)) {
          const filteredPeriods = periodsData.data.filter((period: PeriodeEvaluation) => {
            const periodStartDate = new Date(period.DATE_DEB);
            const periodEndDate = new Date(period.DATE_FIN);
            return (
              (periodStartDate.getTime() === PERIOD_START.getTime() &&
                periodEndDate.getTime() === PERIOD_END.getTime()) ||
              (periodStartDate >= PERIOD_START && periodEndDate <= PERIOD_END)
            );
          });
          setPeriods(filteredPeriods);
        } else {
          setPeriods([]);
        }

        const studentsArray = Object.values(studentsData) as YpareoStudent[];
        const groupsArray = Object.values(groupsData) as YpareoGroup[];
        setAllGroups(groupsArray);

        // Construction de la liste des campus
        const uniqueCampusMap = new Map<number, string>();
        studentsArray.forEach((student) => {
          student.inscriptions.forEach((inscription) => {
            if (!uniqueCampusMap.has(inscription.site.codeSite)) {
              uniqueCampusMap.set(inscription.site.codeSite, inscription.site.nomSite);
            }
          });
        });

        const uniqueCampuses: Campus[] = Array.from(uniqueCampusMap).map(
          ([codeSite, nomSite], index) => ({
            id: `campus-${codeSite}-${index}`,
            codeSite,
            label: nomSite,
          })
        );

        setCampuses(uniqueCampuses);
      } catch (error) {
        console.error("Erreur chargement initial:", error);
        setErrorMessage("Erreur lors du chargement des données initiales");
        setShowErrorModal(true);
        setPeriods([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Barre de progression
  useEffect(() => {
    if (!isLoading) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((prev) => (prev >= 98 ? prev : prev + 1));
    }, 50);
    return () => clearInterval(interval);
  }, [isLoading]);

  const updateGroups = (campusId: string) => {
    const selectedCampus = campuses.find((campus) => campus.id === campusId);
    if (!selectedCampus) return;

    const filteredGroups = allGroups
      .filter((group) => group.codeSite === selectedCampus.codeSite)
      .map((group) => ({ id: group.codeGroupe, label: group.nomGroupe }));

    setGroups(filteredGroups);
  };

  const onSubmit = async (values: FormValues) => {
    try {
      setIsSubmitting(true);

      const selectedCampus = campuses.find((campus) => campus.id === values.campus);
      if (!selectedCampus) throw new Error("Campus non trouvé");

      const selectedPeriod = periods.find((p) => p.CODE_PERIODE_EVALUATION === values.semester);
      if (!selectedPeriod) throw new Error("Période d'évaluation non trouvée");

      if (!values.periodeEvaluationCode || !values.periodeEvaluation) {
        values.periodeEvaluationCode = values.semester;
        values.periodeEvaluation = selectedPeriod.NOM_PERIODE_EVALUATION;
      }

      const selectedGroup = groups.find((group) => group.id.toString() === values.group);
      if (selectedGroup) setSelectedGroupName(selectedGroup.label);

      // Vérification cohérence groupe / période
      const groupName = selectedGroup?.label.toUpperCase() || "";
      const periodName = selectedPeriod.NOM_PERIODE_EVALUATION.toUpperCase();

      if (groupName.includes("ALT") && periodName.includes("TP")) {
        throw new Error(
          `Le groupe "${selectedGroup?.label}" est en alternance, mais la période "${selectedPeriod.NOM_PERIODE_EVALUATION}" est réservée aux temps pleins.`
        );
      }
      if (groupName.includes("TP") && periodName.includes("ALT")) {
        throw new Error(
          `Le groupe "${selectedGroup?.label}" est en temps plein, mais la période "${selectedPeriod.NOM_PERIODE_EVALUATION}" est réservée à l'alternance.`
        );
      }

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
      if (!response.ok) throw new Error(data.error || "Erreur lors de la récupération des données");

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

    if (!dataToUse || !dataToUse.APPRENANT || dataToUse.APPRENANT.length === 0) {
      setErrorMessage("Données insuffisantes pour générer les PDFs.");
      setShowErrorModal(true);
      return;
    }

    try {
      setIsGeneratingPDF(true);

      const selectedPeriod = form.getValues("periodeEvaluation") || "";
      if (!selectedPeriod) throw new Error("Période d'évaluation non définie");
      if (!selectedGroupName) throw new Error("Nom du groupe non défini");

      const selectedPeriodCode = form.getValues("semester");
      const periodWithDates = periods.find((p) => p.CODE_PERIODE_EVALUATION === selectedPeriodCode);

      const response = await fetch("/api/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: dataToUse,
          periodeEvaluation: selectedPeriod,
          groupName: selectedGroupName,
          periodeEvaluationDates: periodWithDates
            ? {
                DATE_DEB: periodWithDates.DATE_DEB,
                DATE_FIN: periodWithDates.DATE_FIN,
                CODE_PERIODE_EVALUATION: periodWithDates.CODE_PERIODE_EVALUATION,
                NOM_PERIODE_EVALUATION: periodWithDates.NOM_PERIODE_EVALUATION,
              }
            : null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Erreur lors de la génération des PDFs");
      }

      const data = await response.json();
      setPdfDownloadUrl(data.path);
      setPdfStudentCount(data.studentCount);
      setShowPdfSuccessModal(true);
    } catch (error: any) {
      setErrorMessage(error.message || "Une erreur est survenue lors de la génération des PDFs");
      setShowErrorModal(true);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // ✅ Fonction de téléchargement extraite du JSX
  const handleDownload = async () => {
    try {
      const response = await fetch(pdfDownloadUrl);
      if (!response.ok) throw new Error(`Erreur ${response.status}: ${response.statusText}`);

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `bulletins_${selectedGroupName.replace(/\s+/g, "_")}.zip`;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      setErrorMessage("Erreur lors du téléchargement: " + (error as Error).message);
      setShowErrorModal(true);
      setShowPdfSuccessModal(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-slate-50 grainy-light px-4">
        <div className="w-full max-w-md">
          <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute top-0 left-0 h-full bg-gradient-to-r from-[#156082] to-[#003349] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-center text-gray-600 mt-4">{`Chargement des données... ${progress}%`}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen bg-slate-50 grainy-light flex items-center justify-center p-3">
        <Card className="w-full max-w-lg mx-4 shadow-none">
          <CardHeader className="pb-4 px-8">
            <div className="flex justify-center mb-2">
              <div className="bg-gradient-to-r from-[#156082] to-[#003349] rounded-full p-3">
                <School className="w-6 h-6 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-center bg-gradient-to-r from-[#156082] to-[#003349] bg-clip-text text-transparent">
              Choisir les bulletins à éditer
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Campus */}
                <FormField
                  control={form.control}
                  name="campus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-md font-semibold text-gray-700">Campus</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value);
                          updateGroups(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 text-sm border-2 focus:border-[#156082]">
                            <SelectValue placeholder="Sélectionnez un campus" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {campuses
                            .filter((campus) => campus.label !== "GROUPE ESPI")
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((campus) => (
                              <SelectItem key={campus.id} value={campus.id} className="text-sm">
                                {campus.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Groupe */}
                <FormField
                  control={form.control}
                  name="group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-md font-semibold text-gray-700">Groupe</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-10 text-sm border-2 focus:border-[#156082]">
                            <SelectValue placeholder="Sélectionnez un groupe" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups
                            .filter((group) => {
                              const startsWithExcluded = EXCLUDED_PREFIXES.some((prefix) =>
                                group.label.startsWith(prefix)
                              );
                              const containsExcluded =
                                group.label.includes("Césure") ||
                                group.label.includes("RP") ||
                                group.label.includes("DDS");
                              return !startsWithExcluded && !containsExcluded;
                            })
                            .sort((a, b) => a.label.localeCompare(b.label))
                            .map((group) => (
                              <SelectItem
                                key={group.id}
                                value={group.id.toString()}
                                className="text-sm"
                              >
                                {group.label}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                {/* Période */}
                <FormField
                  control={form.control}
                  name="semester"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-md font-semibold text-gray-700">
                        Période d&apos;évaluation
                      </FormLabel>
                      <Select
                        onValueChange={(value) => {
                          const selectedPeriod = periods.find(
                            (p) => p.CODE_PERIODE_EVALUATION === value
                          );
                          if (selectedPeriod) {
                            form.setValue("periodeEvaluationCode", value);
                            form.setValue("periodeEvaluation", selectedPeriod.NOM_PERIODE_EVALUATION);
                          }
                          field.onChange(value);
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger className="h-10 text-sm border-2 focus:border-[#156082]">
                            <SelectValue placeholder="Sélectionnez une période" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {periods
                            .filter((period) => !period.NOM_PERIODE_EVALUATION.startsWith("BTS"))
                            .sort((a, b) =>
                              a.NOM_PERIODE_EVALUATION.localeCompare(b.NOM_PERIODE_EVALUATION)
                            )
                            .map((period) => (
                              <SelectItem
                                key={period.CODE_PERIODE_EVALUATION}
                                value={period.CODE_PERIODE_EVALUATION}
                                className="text-sm"
                              >
                                {period.NOM_PERIODE_EVALUATION}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <FormMessage className="text-red-500" />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-10 text-sm font-bold bg-gradient-to-r from-[#156082] to-[#003349] hover:bg-wtm-button-linear-reverse transition-all duration-300 flex items-center justify-center gap-2 mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="w-4 h-4" />
                  )}
                  {isSubmitting ? "Chargement..." : "Confirmer mon choix"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>

      {/* Modale succès données */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Succès
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Les données ont été récupérées avec succès. Vous pouvez maintenant procéder à la
              génération des bulletins.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-center pt-4">
            <Button
              onClick={() => setShowSuccessModal(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Fermer
            </Button>
            <Button
              onClick={handleGeneratePDFs}
              disabled={isGeneratingPDF}
              className="w-full sm:w-auto bg-wtm-button-linear hover:bg-wtm-button-linear-reverse transition-all duration-300 flex items-center justify-center gap-2"
            >
              {isGeneratingPDF ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <FileText className="w-5 h-5" />
              )}
              {isGeneratingPDF ? "Génération en cours..." : "Générer les bulletins PDF"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modale succès PDF */}
      <Dialog open={showPdfSuccessModal} onOpenChange={setShowPdfSuccessModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-6 h-6" />
              Bulletins générés avec succès
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              {pdfStudentCount} bulletins ont été générés et placés dans une archive ZIP.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:justify-center pt-4">
            <Button
              onClick={() => setShowPdfSuccessModal(false)}
              variant="outline"
              className="w-full sm:w-auto"
            >
              Fermer
            </Button>
            <Button
              onClick={handleDownload}
              className="w-full sm:w-auto bg-wtm-button-linear hover:bg-wtm-button-linear-reverse transition-all duration-300 flex items-center justify-center gap-2"
            >
              <FileDown className="w-5 h-5" />
              Télécharger les bulletins
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modale erreur */}
      <Dialog open={showErrorModal} onOpenChange={setShowErrorModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="w-6 h-6" />
              Erreur
            </DialogTitle>
            <DialogDescription className="text-gray-600">{errorMessage}</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}