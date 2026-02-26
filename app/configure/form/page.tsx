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

// Ajout du champ name dans le schéma
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

  useEffect(() => {
    if (session?.user?.email) {
      const getUserData = async () => {
        try {
          const email = session?.user?.email;
          if (email) {
            const response = await fetch(`/api/user?email=${encodeURIComponent(email)}`);
            const data = await response.json();
            if (data?.name) {
              form.setValue("name", data.name);
            }
          }
        } catch (error) {
          console.error("Erreur lors de la récupération du nom:", error);
        }
      };
      getUserData();
    }
  }, [session, form]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        const periodsResponse = await fetch("/api/periods");
        if (!periodsResponse.ok) throw new Error("Erreur périodes");
        const periodsData = await periodsResponse.json();

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

        const studentsResponse = await fetch("/api/students");
        const groupsResponse = await fetch("/api/groups");
        const studentsData = await studentsResponse.json();
        const groupsData = await groupsResponse.json();

        const studentsArray = Object.values(studentsData) as YpareoStudent[];
        const groupsArray = Object.values(groupsData) as YpareoGroup[];
        setAllGroups(groupsArray);

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
            codeSite: codeSite,
            label: nomSite,
          })
        );
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

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isLoading) {
      setProgress(0);
      interval = setInterval(() => {
        setProgress((prev) => (prev >= 98 ? prev : prev + 1));
      }, 50);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // 1. Modifiez updateGroups pour qu'il puisse être appelé avec le reset du formulaire
  const updateGroups = (campusId: string) => {
    const selectedCampus = campuses.find((campus) => campus.id === campusId);
    if (!selectedCampus) {
      setGroups([]);
      return;
    }

    const filteredGroups = allGroups
      .filter((group) => group.codeSite === selectedCampus.codeSite)
      .map((group) => ({
        id: group.codeGroupe,
        label: group.nomGroupe,
      }));

    setGroups(filteredGroups);

    // IMPORTANT : On vide la sélection du groupe dès que le campus change
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

      // Logique de vérification ALT/TP
      const groupName = selectedGroup?.label.toUpperCase() || "";
      const periodName = selectedPeriod.NOM_PERIODE_EVALUATION.toUpperCase();
      if (groupName.includes("ALT") && periodName.includes("TP")) {
        throw new Error(`Incohérence : Groupe Alternance avec période Temps Plein.`);
      }
      if (groupName.includes("TP") && periodName.includes("ALT")) {
        throw new Error(`Incohérence : Groupe Temps Plein avec période Alternance.`);
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

  if (isLoading) {
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
                {/* 2. Dans le rendu du Select Campus */}
                <FormField
                  control={form.control}
                  name="campus"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Campus</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          field.onChange(value); // Met à jour le formulaire
                          updateGroups(value);   // Filtre les groupes et reset le champ "group"
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
                            .filter((c) => c.label !== "GROUPE ESPI")
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

                {/* 3. Dans le rendu du Select Groupe */}
                <FormField
                  control={form.control}
                  name="group"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-semibold">Groupe</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        value={field.value || ""} // Sécurité pour éviter le passage de undefined à défini
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
                            <div className="p-2 text-sm text-gray-500">Séléctionner d'abord un campus pour choisir un groupe</div>
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

      {/* Modales */}
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
                const response = await fetch(pdfDownloadUrl);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `bulletins_${selectedGroupName.replace(/\s+/g, "_")}.zip`;
                a.click();
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
