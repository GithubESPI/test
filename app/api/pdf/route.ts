/* eslint-disable @typescript-eslint/no-explicit-any */
// Utiliser fileStorage au lieu de tempFileStorage
import { fileStorage } from "@/lib/fileStorage";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// Modification de la fonction getEtatUE pour gérer l'exception de l'UE 4
function getEtatUE(etatsMatieres: string[]): string {
  // Si une seule matière est NV ou R, l'UE entière est NV
  if (etatsMatieres.includes("NV") || etatsMatieres.includes("R")) {
    return "NV";
  } else if (etatsMatieres.includes("C")) {
    return "VA";
  } else {
    return "VA";
  }
}
// Type definitions for the student data
interface StudentData {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  DATE_NAISSANCE?: string;
  [key: string]: any;
}

interface StudentGrade {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  CODE_MATIERE: string;
  NOM_MATIERE: string;
  MOYENNE: number;
  NOM_PERIODE_EVALUATION: string;
  [key: string]: any;
}

interface StudentAverage {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  MOYENNE_GENERALE: number;
  [key: string]: any;
}

interface Observation {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  MEMO_OBSERVATION: string;
  [key: string]: any;
}

interface SubjectECTS {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  CODE_MATIERE: string;
  NOM_MATIERE: string;
  CREDIT_ECTS: number;
  [key: string]: any;
}

interface GroupInfo {
  NOM_GROUPE: string;
  ETENDU_GROUPE?: string;
  NOM_FORMATION?: string;
  CODE_PERSONNEL?: string;
  NOM_PERSONNEL?: string;
  PRENOM_PERSONNEL?: string;
  NOM_FONCTION_PERSONNEL?: string;
  [key: string]: any;
}

interface CampusInfo {
  CODE_SITE: number;
  NOM_SITE: string;
  [key: string]: any;
}

interface Absence {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  IS_JUSTIFIE: string | number;
  IS_RETARD: string | number;
  DUREE: string | number;
  DATE_DEB: string;
  DATE_FIN: string;
  CODE_ABSENCE: string;
}

interface ProcessedAbsence {
  CODE_APPRENANT: string;
  NOM_APPRENANT: string;
  PRENOM_APPRENANT: string;
  ABSENCES_JUSTIFIEES: string;
  ABSENCES_INJUSTIFIEES: string;
  RETARDS: string;
}

interface DuplicateStat {
  codeAbsence: string;
  count: number;
  durees: number[];
  totalDuree: number;
  maxDuree: number;
  dates: string;
}

// ... interfaces inchangées ...

function processAbsences(
  absences: Absence[],
  startDate = "2024-08-26 00:00:00",
  endDate = "2025-08-24 00:00:00",
  handleDuplicates: "sum" | "max" | "deduplicate" = "sum"
): {
  students: ProcessedAbsence[];
  globalTotals: {
    justifiees: number;
    injustifiees: number;
    retards: number;
    justifieesFormatted: string;
    injustifieesFormatted: string;
    retardsFormatted: string;
  };
  duplicatesInfo: {
    duplicateGroups: any[];
    totalDuplicates: number;
  };
} {
  const groupedAbsences: Record<string, ProcessedAbsence> = {};
  const filterStartDate = new Date(startDate);
  const filterEndDate = new Date(endDate);

  const duplicateGroups: Record<string, any[]> = {};

  absences.forEach((absence, index) => {
    const { CODE_ABSENCE, DATE_DEB, DUREE } = absence;
    if (DATE_DEB) {
      try {
        const absenceDate = new Date(DATE_DEB.replace(" ", "T"));
        if (absenceDate < filterStartDate || absenceDate > filterEndDate) {
          return;
        }
      } catch {
        return;
      }
    }

    const duree = parseInt(DUREE?.toString() || "0", 10);
    if (duree <= 0) return;

    if (!duplicateGroups[CODE_ABSENCE]) {
      duplicateGroups[CODE_ABSENCE] = [];
    }

    duplicateGroups[CODE_ABSENCE].push({
      ...absence,
      originalIndex: index,
      duree: duree,
    });
  });

  const duplicateStats: DuplicateStat[] = [];
  let totalDuplicatesFound = 0;

  Object.keys(duplicateGroups).forEach((codeAbsence) => {
    const group = duplicateGroups[codeAbsence];

    if (group.length > 1) {
      totalDuplicatesFound++;
      const totalDuree = group.reduce((sum, item) => sum + item.duree, 0);
      const maxDuree = Math.max(...group.map((item) => item.duree));

      duplicateStats.push({
        codeAbsence,
        count: group.length,
        durees: group.map((item) => item.duree),
        totalDuree,
        maxDuree,
        dates: group[0].DATE_DEB + " → " + group[0].DATE_FIN,
      });

      console.log(`🔍 CODE_ABSENCE ${codeAbsence}: ${group.length} enregistrements`);
      console.log(`   Durées: ${group.map((item) => item.duree).join(", ")} min`);
      console.log(`   Total: ${totalDuree} min, Max: ${maxDuree} min`);
      console.log(`   Période: ${group[0].DATE_DEB} → ${group[0].DATE_FIN}`);
    }
  });

  let totalJustifiees = 0;
  let totalInjustifiees = 0;
  let totalRetards = 0;

  Object.values(duplicateGroups).forEach((group) => {
    const representative = group[0];
    const {
      CODE_APPRENANT,
      NOM_APPRENANT,
      PRENOM_APPRENANT,
      IS_JUSTIFIE,
      IS_RETARD,
      CODE_ABSENCE,
      DATE_DEB,
      DATE_FIN,
    } = representative;

    if (!groupedAbsences[CODE_APPRENANT]) {
      groupedAbsences[CODE_APPRENANT] = {
        CODE_APPRENANT,
        NOM_APPRENANT,
        PRENOM_APPRENANT,
        ABSENCES_JUSTIFIEES: "00h00",
        ABSENCES_INJUSTIFIEES: "00h00",
        RETARDS: "00h00",
      };
    }

    // ✅ Si au moins 2 enregistrements avec la même CODE_ABSENCE ont des DUREE différentes ET même DATE_DEB/DATE_FIN => probablement multi-jour fractionné
    const hasMultipleEntries = group.length > 1;
    const uniqueDurations = new Set(group.map((item) => item.duree)).size;
    const sameDates = group.every(
      (item) => item.DATE_DEB === DATE_DEB && item.DATE_FIN === DATE_FIN
    );
    const isSplitOverMultipleLines = hasMultipleEntries && sameDates && uniqueDurations >= 1;

    let dureeToUse = 0;
    if (isSplitOverMultipleLines) {
      dureeToUse = group.reduce((sum, item) => sum + item.duree, 0);
    } else {
      switch (handleDuplicates) {
        case "sum":
          dureeToUse = group.reduce((sum, item) => sum + item.duree, 0);
          break;
        case "max":
          dureeToUse = Math.max(...group.map((item) => item.duree));
          break;
        case "deduplicate":
          dureeToUse = group[0].duree;
          break;
      }
    }

    const student = groupedAbsences[CODE_APPRENANT];
    const isJustifie = IS_JUSTIFIE === 1 || IS_JUSTIFIE === "1";
    const isRetard = IS_RETARD === 1 || IS_RETARD === "1";
    const isInjustifie =
      (IS_JUSTIFIE === 0 || IS_JUSTIFIE === "0") && (IS_RETARD === 0 || IS_RETARD === "0");

    if (group.length > 1) {
      console.log(
        `📝 ${CODE_ABSENCE}: Durée utilisée = ${dureeToUse}min (méthode: ${handleDuplicates}${
          isSplitOverMultipleLines ? " + multi-jour" : ""
        })`
      );
    }

    if (isRetard) {
      const prev = parseTimeToMinutes(student.RETARDS);
      student.RETARDS = formatTime(prev + dureeToUse);
      totalRetards += dureeToUse;
    } else if (isJustifie) {
      const prev = parseTimeToMinutes(student.ABSENCES_JUSTIFIEES);
      student.ABSENCES_JUSTIFIEES = formatTime(prev + dureeToUse);
      totalJustifiees += dureeToUse;
    } else if (isInjustifie) {
      const prev = parseTimeToMinutes(student.ABSENCES_INJUSTIFIEES);
      student.ABSENCES_INJUSTIFIEES = formatTime(prev + dureeToUse);
      totalInjustifiees += dureeToUse;
    }
  });

  console.log("\n====== STATISTIQUES GLOBALES ======");
  console.log(`📊 CODE_ABSENCE uniques traités: ${Object.keys(duplicateGroups).length}`);
  console.log(`📊 Groupes avec doublons: ${totalDuplicatesFound}`);
  console.log(`📊 Total justifiées: ${formatTime(totalJustifiees)} (${totalJustifiees} min)`);
  console.log(`📊 Total injustifiées: ${formatTime(totalInjustifiees)} (${totalInjustifiees} min)`);
  console.log(`📊 Total retards: ${formatTime(totalRetards)} (${totalRetards} min)`);

  return {
    students: Object.values(groupedAbsences),
    globalTotals: {
      justifiees: totalJustifiees,
      injustifiees: totalInjustifiees,
      retards: totalRetards,
      justifieesFormatted: formatTime(totalJustifiees),
      injustifieesFormatted: formatTime(totalInjustifiees),
      retardsFormatted: formatTime(totalRetards),
    },
    duplicatesInfo: {
      duplicateGroups: duplicateStats,
      totalDuplicates: totalDuplicatesFound,
    },
  };
}

// Fonctions utilitaires (inchangées)
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || timeStr === "00h00") return 0;
  const parts = timeStr.match(/(\d+)h(\d+)/);
  if (!parts) return 0;
  return parseInt(parts[1]) * 60 + parseInt(parts[2]);
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}h${mins.toString().padStart(2, "0")}`;
}

// Fonction pour convertir un texte "hhmm" en minutes

function updateUECredits(subjects: any[]): any[] {
  // 1. Cloner les sujets pour ne pas modifier les originaux
  const result = subjects.map((subject) => ({ ...subject }));

  // 2. Éliminer les doublons
  const uniqueSubjectsMap = new Map<string, any>();

  result.forEach((subject) => {
    const key = `${subject.CODE_APPRENANT}_${subject.CODE_MATIERE}`;
    // Conversion des crédits ECTS en nombre pour assurer des calculs corrects
    if (subject.CREDIT_ECTS !== undefined) {
      subject.CREDIT_ECTS = Number(subject.CREDIT_ECTS) || 0;
    }

    // Si la clé n'existe pas encore ou si cette entrée a plus d'informations
    if (!uniqueSubjectsMap.has(key)) {
      uniqueSubjectsMap.set(key, { ...subject });
    }
  });

  // 3. Regrouper par étudiant pour traitement individuel
  const studentSubjects = new Map<string, any[]>();

  [...uniqueSubjectsMap.values()].forEach((subject) => {
    const studentId = subject.CODE_APPRENANT;
    if (!studentSubjects.has(studentId)) {
      studentSubjects.set(studentId, []);
    }
    studentSubjects.get(studentId)?.push({ ...subject });
  });

  // 4. Traiter les matières par étudiant
  const finalResult: any[] = [];

  studentSubjects.forEach((studentSubjectList, studentId) => {
    console.log(`\n🔍 Traitement des matières pour l'étudiant ${studentId}`);

    // Trier les matières par NUM_ORDRE
    const sortedSubjects = studentSubjectList.sort((a, b) => {
      const orderA = parseInt(a.NUM_ORDRE || "0", 10);
      const orderB = parseInt(b.NUM_ORDRE || "0", 10);
      return orderA - orderB;
    });

    // Ne pas recalculer les ECTS des UEs, mais les préserver
    sortedSubjects.forEach((subject) => {
      if (subject.NOM_MATIERE && subject.NOM_MATIERE.startsWith("UE")) {
        console.log(`UE trouvée: ${subject.NOM_MATIERE} avec ${subject.CREDIT_ECTS} ECTS`);
        // Conserver les ECTS déjà assignés
      }
    });

    // Ajouter toutes les matières de cet étudiant au résultat final
    finalResult.push(...sortedSubjects);
  });

  return finalResult;
}

function logUEWithSubjects(subjects: any[]) {
  // Éliminer les doublons d'abord
  const uniqueSubjects = new Map<string, any>();

  subjects.forEach((subject) => {
    const key = `${subject.CODE_APPRENANT}_${subject.CODE_MATIERE}`;
    if (!uniqueSubjects.has(key)) {
      uniqueSubjects.set(key, subject);
    }
  });

  let currentUE: any = null;
  let ueSubjects: any[] = [];
  let currentStudent: string = "";

  console.log("📌 Début du log des matières et des UE associées.");

  // Trier par étudiant, puis par ordre
  const sortedSubjects = [...uniqueSubjects.values()].sort((a, b) => {
    if (a.CODE_APPRENANT !== b.CODE_APPRENANT) {
      return a.CODE_APPRENANT.localeCompare(b.CODE_APPRENANT);
    }
    return parseInt(a.NUM_ORDRE, 10) - parseInt(b.NUM_ORDRE, 10);
  });

  for (const subject of sortedSubjects) {
    // Si on change d'étudiant, réinitialiser
    if (subject.CODE_APPRENANT !== currentStudent) {
      // Afficher les dernières UE de l'étudiant précédent
      if (currentUE) {
        console.log(`✅ UE Trouvée : ${currentUE.NOM_MATIERE} pour ${currentStudent}`);
        console.log(
          `📌 Matières associées :`,
          ueSubjects.map((s) => s.NOM_MATIERE)
        );
      }

      currentStudent = subject.CODE_APPRENANT;
      currentUE = null;
      ueSubjects = [];
      console.log(`\n👤 Nouvel étudiant: ${subject.NOM_APPRENANT} ${subject.PRENOM_APPRENANT}`);
    }

    if (subject.CODE_TYPE_MATIERE === "2") {
      // Nouvelle UE trouvée, afficher les logs pour l'UE précédente
      if (currentUE) {
        console.log(`✅ UE Trouvée : ${currentUE.NOM_MATIERE}`);
        console.log(
          `📌 Matières associées :`,
          ueSubjects.map((s) => s.NOM_MATIERE)
        );
      }
      // Mettre à jour l'UE courante et réinitialiser les matières associées
      currentUE = subject;
      ueSubjects = [];
    } else if (currentUE && subject.CODE_TYPE_MATIERE === "3") {
      // Associer la matière courante à l'UE actuelle
      ueSubjects.push(subject);
    }
  }

  // Afficher les logs de la dernière UE trouvée
  if (currentUE) {
    console.log(`✅ UE Trouvée : ${currentUE.NOM_MATIERE} pour ${currentStudent}`);
    console.log(
      `📌 Matières associées :`,
      ueSubjects.map((s) => s.NOM_MATIERE)
    );
  }

  console.log("📌 Fin du log des matières et des UE associées.");
}

function associerMatieresAuxUE(
  grades: StudentGrade[]
): Map<string, { ue: StudentGrade; matieres: StudentGrade[] }> {
  const ueMap = new Map<string, { ue: StudentGrade; matieres: StudentGrade[] }>();

  // 1. D'abord, identifier toutes les UE
  const ues = grades.filter((g) => g.NOM_MATIERE.startsWith("UE"));

  // 2. Créer les entrées pour chaque UE
  for (const ue of ues) {
    ueMap.set(ue.CODE_MATIERE, { ue, matieres: [] });
  }

  // 3. Associer les matières à leur UE en utilisant le NUM_ORDRE ou CODE_UE_PARENT si disponible
  for (const grade of grades) {
    if (!grade.NOM_MATIERE.startsWith("UE")) {
      // Si un CODE_UE_PARENT existe, l'utiliser
      if (grade.CODE_UE_PARENT && ueMap.has(grade.CODE_UE_PARENT)) {
        ueMap.get(grade.CODE_UE_PARENT)?.matieres.push(grade);
      }
      // Sinon, essayer de trouver l'UE la plus proche basée sur NUM_ORDRE
      else {
        const gradeOrder = parseInt(grade.NUM_ORDRE || "999", 10);
        let bestMatchUE = null;
        let smallestDiff = Infinity;

        for (const ue of ues) {
          const ueOrder = parseInt(ue.NUM_ORDRE || "0", 10);
          const diff = gradeOrder - ueOrder;

          // Ne considérer que les UE qui précèdent cette matière
          if (diff > 0 && diff < smallestDiff) {
            smallestDiff = diff;
            bestMatchUE = ue;
          }
        }

        if (bestMatchUE) {
          ueMap.get(bestMatchUE.CODE_MATIERE)?.matieres.push(grade);
        }
      }
    }
  }

  return ueMap;
}

// Fonction d'aide pour obtenir le nom du fichier de signature en fonction du code personnel
function getSignatureFilename(codePersonnel: string): string | null {
  // Mapping entre les codes personnels gestionnaires et les noms de fichiers de signature
  const signatureMap: Record<string, string> = {
    "460": "christine.jpg",
    "482": "ludivinelaунay.png",
    "500": "estelle.jpg",
    "517": "signYoussefSAKER.jpg",
    "2239": "signature_marionsoustelle.png",
    "306975": "lebon.png",
    "89152": "magali.png",
    "650429": "", // Ajout pour le CODE_PERSONNEL
    // You can add more mappings as needed
  };

  return signatureMap[codePersonnel] || null;
}

// Function to create a PDF for a student
// Function to create a PDF for a student
async function createStudentPDF(
  student: StudentData,
  grades: StudentGrade[],
  averages: StudentAverage[],
  observations: Observation[],
  subjects: SubjectECTS[], // Single subjects parameter
  groupInfo: GroupInfo[],
  campusInfo: CampusInfo[],
  period: string,
  absence: Absence[],
  processedABS: ProcessedAbsence[],
  personnelData?: any[],
  notes?: any[]
): Promise<Uint8Array> {
  try {
    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]); // Format A4

    // Initialize ueEtats Map at the beginning of the function
    const ueEtats = new Map<string, string>();

    // Charger les polices Poppins (s'ils sont disponibles)
    let poppinsRegular;
    let poppinsBold;

    try {
      // Chemins vers les fichiers de police (ajustez selon l'emplacement de vos fichiers)
      const poppinsRegularPath = path.join(process.cwd(), "public", "fonts", "Poppins-Regular.ttf");
      const poppinsBoldPath = path.join(process.cwd(), "public", "fonts", "Poppins-Bold.ttf");

      // Lire les fichiers de police
      const poppinsRegularBytes = fs.readFileSync(poppinsRegularPath);
      const poppinsBoldBytes = fs.readFileSync(poppinsBoldPath);

      pdfDoc.registerFontkit(fontkit);

      // Incorporer les polices dans le document PDF
      poppinsRegular = await pdfDoc.embedFont(poppinsRegularBytes);
      poppinsBold = await pdfDoc.embedFont(poppinsBoldBytes);

      console.log("✅ Polices Poppins chargées avec succès");
    } catch (error) {
      console.error("❌ Erreur lors du chargement des polices Poppins:", error);
      console.log("Utilisation des polices standard comme fallback");
    }

    // Définir les polices à utiliser (avec fallback sur des polices standard si Poppins n'est pas disponible)
    const mainFont = poppinsRegular || (await pdfDoc.embedFont(StandardFonts.Helvetica));
    const boldFont = poppinsBold || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));

    // Définir une taille de police plus petite par défaut
    const fontSize = 8;
    const fontSizeBold = 8;
    const fontSizeTitle = 11;
    // const fontSizeHeader = 10;

    // Set up margins
    const margin = 50;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    let currentY = pageHeight - margin;

    // Associer les matières à leurs UE respectives
    const studentGrades = grades.filter((g) => g.CODE_APPRENANT === student.CODE_APPRENANT);
    console.log(
      `Nombre de notes pour l'étudiant ${student.CODE_APPRENANT}: ${studentGrades.length}`
    );
    const ueMap = associerMatieresAuxUE(studentGrades);

    // Calculer pour chaque matière si elle est en rattrapage (R) en fonction de sa moyenne
    const matiereEtats = new Map<string, string>();
    // Initialiser la map pour contenir les états de UE qui ont des matières en rattrapage

    // 1. Amélioration du traitement initial des moyennes et états
    for (const grade of studentGrades) {
      // Traitement des moyennes textuelles ou vides
      const moyenneStr = String(grade.MOYENNE || "")
        .toUpperCase()
        .trim();

      if (moyenneStr === "VA") {
        matiereEtats.set(grade.CODE_MATIERE, "VA");
        continue;
      } else if (moyenneStr === "NV" || moyenneStr === "" || moyenneStr === "-") {
        matiereEtats.set(grade.CODE_MATIERE, "NV");
        console.log(`État défini à NV pour ${grade.NOM_MATIERE} (moyenne: "${moyenneStr}")`);
        continue;
      }

      // Pour les moyennes numériques
      try {
        const moyenneValue = parseFloat(moyenneStr.replace(",", "."));
        if (!isNaN(moyenneValue)) {
          if (moyenneValue >= 10) {
            matiereEtats.set(grade.CODE_MATIERE, "VA");
          } else if (moyenneValue < 8) {
            matiereEtats.set(grade.CODE_MATIERE, "R");
          } else {
            matiereEtats.set(grade.CODE_MATIERE, "TEMP_8_10");
          }
        } else {
          // Si la conversion échoue, on met NV par défaut
          matiereEtats.set(grade.CODE_MATIERE, "NV");
          console.log(
            `État défini à NV pour ${grade.NOM_MATIERE} (moyenne non numérique: "${moyenneStr}")`
          );
        }
      } catch (error) {
        // En cas d'erreur, on met NV par défaut
        matiereEtats.set(grade.CODE_MATIERE, "NV");
        console.log(`Erreur pour ${grade.NOM_MATIERE}, état défini à NV:`, error);
      }
    }

    // 👇 Ce bloc garantit que chaque matière a un état, même si l'apprenant est absent toute l'année
    // S'assurer que toutes les matières ont un état, sinon mettre NV
    for (const { matieres } of ueMap.values()) {
      for (const matiere of matieres) {
        if (!matiereEtats.has(matiere.CODE_MATIERE)) {
          const moyenneBrute = grades
            .find(
              (g) =>
                g.CODE_APPRENANT === student.CODE_APPRENANT &&
                g.CODE_MATIERE === matiere.CODE_MATIERE
            )
            ?.MOYENNE?.toString()
            .toUpperCase();

          if (moyenneBrute === "VA" || moyenneBrute === "NV") {
            matiereEtats.set(matiere.CODE_MATIERE, moyenneBrute);
            console.log(
              `⚠️ Rattrapage in-extremis via moyenne brute : ${matiere.NOM_MATIERE} → ${moyenneBrute}`
            );
          } else {
            matiereEtats.set(matiere.CODE_MATIERE, "NV");
            console.log(`⚠️ Matière sans note ni état, forcée à NV : ${matiere.NOM_MATIERE}`);
          }
        }
      }
    }

    for (const [ueCode, { matieres }] of ueMap) {
      // Étape 1 : Compter les états des matières
      let countR = 0; // Rattrapage
      let count8_10 = 0; // TEMP_8_10 (entre 8 et 10)
      let countVA = 0; // Validées
      let countC = 0; // Compensées

      // 1. Compter les matières par état (avant modifications)
      for (const matiere of matieres) {
        const etat = matiereEtats.get(matiere.CODE_MATIERE);
        if (etat === "R") countR++;
        else if (etat === "TEMP_8_10") count8_10++;
        else if (etat === "VA") countVA++;
        else if (etat === "C") countC++;
      }

      console.log(
        `UE ${ueCode}: Matières (total=${matieres.length}, VA=${countVA}, C=${countC}, 8-10=${count8_10}, R=${countR})`
      );

      // Étape 2 : Gérer les cas de compensation pour les matières TEMP_8_10
      if (count8_10 > 0) {
        if (countR > 0) {
          for (const matiere of matieres) {
            if (matiereEtats.get(matiere.CODE_MATIERE) === "TEMP_8_10") {
              matiereEtats.set(matiere.CODE_MATIERE, "R");
              console.log(
                `Matière ${matiere.NOM_MATIERE}: mise en R car UE contient des matières en R`
              );
            }
          }
        } else if (matieres.length === 1 && count8_10 === 1) {
          const matiere = matieres[0];
          matiereEtats.set(matiere.CODE_MATIERE, "R");
          console.log(
            `Matière ${matiere.NOM_MATIERE}: mise en R car UE n'a qu'une seule matière entre 8 et 10`
          );
        } else if (countVA >= 1 && count8_10 === 1) {
          for (const matiere of matieres) {
            if (matiereEtats.get(matiere.CODE_MATIERE) === "TEMP_8_10") {
              matiereEtats.set(matiere.CODE_MATIERE, "C");
              console.log(
                `Matière ${matiere.NOM_MATIERE}: mise en C car UE contient des matières en VA`
              );
            }
          }
        } else {
          for (const matiere of matieres) {
            if (matiereEtats.get(matiere.CODE_MATIERE) === "TEMP_8_10") {
              matiereEtats.set(matiere.CODE_MATIERE, "R");
              console.log(`Matière ${matiere.NOM_MATIERE}: mise en R (cas par défaut)`);
            }
          }
        }
      }

      const etatsMatieres = matieres.map((m) => matiereEtats.get(m.CODE_MATIERE) || "NV");
      const ueFinalEtat = getEtatUE(etatsMatieres);
      ueEtats.set(ueCode, ueFinalEtat);

      console.log(
        `UE ${ueCode} = ${ueFinalEtat} (états des matières : ${matieres
          .map((m) => `${m.NOM_MATIERE}=${matiereEtats.get(m.CODE_MATIERE)}`)
          .join(", ")})`
      );
    }

    // 4. Créer une map pour associer les matières à leurs UE (par code)
    const matiereToUeMap = new Map<string, string>();
    for (const [ueCode, { matieres }] of ueMap) {
      for (const matiere of matieres) {
        matiereToUeMap.set(matiere.CODE_MATIERE, ueCode);
      }
    }

    for (const subject of subjects.filter((s) => s.CODE_APPRENANT === student.CODE_APPRENANT)) {
      if (!subject.NOM_MATIERE.startsWith("UE") && !matiereEtats.has(subject.CODE_MATIERE)) {
        // Vérifier si une note existe dans la table des notes
        const note = notes?.find(
          (n) =>
            n.CODE_APPRENANT === student.CODE_APPRENANT && n.CODE_MATIERE === subject.CODE_MATIERE
        );

        if (note && note.CODE_EVALUATION_NOTE === "1") {
          matiereEtats.set(subject.CODE_MATIERE, "VA");
        } else {
          matiereEtats.set(subject.CODE_MATIERE, "NV");
          console.log(`Matière sans état ni moyenne définie à NV: ${subject.NOM_MATIERE}`);
        }
      }
    }

    // Dans la boucle où vous traitez les UE
    for (const [ueCode, { ue, matieres }] of ueMap.entries()) {
      // Si c'est l'UE 4 spécifiquement
      // Si c'est l'UE 4 spécifiquement
      // Si c'est l'UE 4 spécifiquement
      // Si c'est l'UE 4 spécifiquement
      // Si c'est l'UE 4 spécifiquement
      // Si c'est l'UE 4 spécifiquement
      // Si c'est l'UE 4 spécifiquement
      if (ue.NOM_MATIERE && ue.NOM_MATIERE.includes("UE 4")) {
        console.log(`Traitement spécial pour ${ue.NOM_MATIERE}`);

        // Vérifier si une matière de l'UE 4 est en NV ou R
        const hasNVorR = matieres.some((m) => {
          const etat = matiereEtats.get(m.CODE_MATIERE);
          console.log(`Matière de l'UE 4: ${m.NOM_MATIERE}, état: ${etat}`);
          return etat === "NV" || etat === "R";
        });

        // Vérifier également les matières qui pourraient ne pas être correctement associées
        const additionalMatieres = [
          "Communication Digitale et Orale",
          "ESPI Career Services",
          "ESPI Inside",
          "Real Estate English",
          "Rencontres de l'Immobilier",
          "Immersion Professionnelle",
          "Projet Voltaire",
          "Real Estate English & TOEFL",
          "Mémoire de Recherche",
          "Méthodologie de la Recherche",
          "Mobilité Internationale",
          "Techniques de Négociation",
          "Real Estate Industry Overview",
          "Dissertation Methodology",
        ];

        const hasAdditionalNVorR = Array.from(matiereEtats.entries()).some(
          ([codeMatiere, etat]) => {
            if (etat !== "NV" && etat !== "R") return false;

            const matiere = subjects.find(
              (s) => s.CODE_APPRENANT === student.CODE_APPRENANT && s.CODE_MATIERE === codeMatiere
            );

            if (!matiere || !matiere.NOM_MATIERE) return false;

            const isUE4Matiere = additionalMatieres.some((name) =>
              matiere.NOM_MATIERE.includes(name)
            );

            if (isUE4Matiere) {
              console.log(
                `Matière supplémentaire de l'UE 4 détectée: ${matiere.NOM_MATIERE}, état: ${etat}`
              );
            }

            return isUE4Matiere;
          }
        );

        if (hasNVorR || hasAdditionalNVorR) {
          console.log(
            `🔴 OVERRIDE FINAL UE 4: Forcée à NV car contient au moins une matière en NV ou R`
          );
          ueEtats.set(ueCode, "NV");
        } else {
          console.log(`UE 4: Toutes les matières sont validées, état VA`);
          ueEtats.set(ueCode, "VA");
        }
      }
      console.log(`État final de l'UE ${ue.NOM_MATIERE}: ${ueEtats.get(ueCode)}`);
    }
    // 5. Mettre à jour les ECTS des matières en rattrapage
    for (const subject of subjects) {
      if (subject.CODE_APPRENANT === student.CODE_APPRENANT) {
        const etat = matiereEtats.get(subject.CODE_MATIERE);
        // Si la matière est en rattrapage et n'est pas une UE, mettre son ECTS à 0
        if (etat === "R" && !subject.NOM_MATIERE.startsWith("UE")) {
          console.log(`Mise à jour ECTS à 0 pour matière en rattrapage: ${subject.NOM_MATIERE}`);
          subject.CREDIT_ECTS = 0;
        }
      }
    }

    // ESPI Logo and header section
    const logoOffsetLeft = 20; // Vous pouvez ajuster cette valeur selon le décalage souhaité

    try {
      const logoPath = path.join(process.cwd(), "public", "logo", "espi.jpg");
      const logoBytes = fs.readFileSync(logoPath);
      const logoImage = await pdfDoc.embedJpg(logoBytes);

      // Obtenir les dimensions de l'image
      const logoDims = logoImage.scale(0.25); // Ajustez l'échelle selon vos besoins

      // Positionner le logo plus haut
      currentY = pageHeight - margin / 2; // Ajuster pour positionner plus haut

      page.drawImage(logoImage, {
        x: margin - logoOffsetLeft, // Décaler vers la gauche par rapport à la marge standard
        y: currentY - logoDims.height,
        width: logoDims.width,
        height: logoDims.height,
      });

      // Ajuster currentY pour compenser la hauteur du logo
      currentY -= logoDims.height;
    } catch (error) {
      console.error("Erreur lors du chargement du logo ESPI:", error);
      // Fallback au texte si l'image ne peut pas être chargée
      page.drawText("ESPI", {
        x: margin - logoOffsetLeft, // Appliquer le même décalage au texte de secours
        y: currentY,
        size: 24,
        font: mainFont,
        color: rgb(0.2, 0.6, 0.6),
      });
    }

    // Couleur corporative ESPI
    const espiBlue = rgb(0.04, 0.36, 0.51);
    const espiGray = rgb(0.925, 0.925, 0.925);

    // Identifiant de l'étudiant
    currentY -= 10;
    page.drawText(`Identifiant : ${student.CODE_APPRENANT}`, {
      x: pageWidth - margin - 150,
      y: currentY,
      size: 4,
      font: mainFont,
      color: rgb(1, 1, 1),
    });

    // Titre du bulletin
    currentY -= 10;
    const bulletinTitle = "Bulletin de notes 2024-2025";
    const bulletinTitleWidth = boldFont.widthOfTextAtSize(bulletinTitle, fontSizeTitle);
    page.drawText(bulletinTitle, {
      x: (pageWidth - bulletinTitleWidth) / 2,
      y: currentY,
      size: fontSizeTitle,
      font: boldFont,
      color: espiBlue,
    });

    const group = groupInfo.length > 0 ? groupInfo[0] : null;
    const etenduGroupe = group && group.ETENDU_GROUPE ? group.ETENDU_GROUPE : "";

    // Semestre
    currentY -= 20;
    const periodeText = `${etenduGroupe} ${period}`;
    const periodeTextWidth = boldFont.widthOfTextAtSize(periodeText, fontSizeTitle);
    page.drawText(periodeText, {
      x: (pageWidth - periodeTextWidth) / 2,
      y: currentY,
      size: fontSizeTitle,
      font: boldFont,
      color: espiBlue,
    });

    currentY -= 20;

    // Cadre d'informations étudiant et groupe
    const boxWidth = pageWidth - 2 * margin;
    const boxHeight = 40;

    // Dessiner le rectangle
    page.drawRectangle({
      x: margin,
      y: currentY - boxHeight,
      width: boxWidth,
      height: boxHeight,
      borderColor: espiBlue,
      borderWidth: 1,
    });

    // Ligne verticale au milieu
    page.drawLine({
      start: { x: margin + boxWidth / 2, y: currentY },
      end: { x: margin + boxWidth / 2, y: currentY - boxHeight },
      thickness: 1,
      color: espiBlue,
    });

    // Informations étudiant côté gauche
    page.drawText(`Apprenant : ${student.NOM_APPRENANT} ${student.PRENOM_APPRENANT}`, {
      x: margin + 5,
      y: currentY - 15,
      size: fontSizeBold,
      font: mainFont,
      color: espiBlue,
    });

    if (student.DATE_NAISSANCE) {
      page.drawText(
        `Date de naissance : ${new Date(student.DATE_NAISSANCE).toLocaleDateString("fr-FR")}`,
        {
          x: margin + 5,
          y: currentY - 30,
          size: fontSize,
          font: mainFont,
          color: espiBlue,
        }
      );
    }

    // Groupe et campus côté droit
    const campus = campusInfo.length > 0 ? campusInfo[0] : null;

    page.drawText(`Groupe : ${group ? group.NOM_GROUPE : "Non spécifié"}`, {
      x: margin + boxWidth / 2 + 5,
      y: currentY - 15,
      size: fontSize,
      font: mainFont,
      color: espiBlue,
    });

    page.drawText(`Campus : ${campus ? campus.NOM_SITE : "Non spécifié"}`, {
      x: margin + boxWidth / 2 + 5,
      y: currentY - 30,
      size: fontSize,
      font: mainFont,
      color: espiBlue,
    });

    currentY -= boxHeight + 10;

    // Tableau des notes
    // En-têtes
    const rowHeight = 20;
    // 1. Calculate the center of the page

    // 2. Define the table width - make it slightly narrower than the full width
    const tableWidth = boxWidth; // 90% of the available width between margins

    // 3. Calculate table position to center it
    const tableLeftMargin = margin + (boxWidth - tableWidth) / 2;

    // 4. Update column positions based on the centered table
    const col1Width = tableWidth * 0.55; // 55% for the subjects (increased for better text display)
    const col2Width = tableWidth * 0.15; // 15% for the average
    const col3Width = tableWidth * 0.15; // 15% for the ECTS
    const col4Width = tableWidth * 0.15; // 15% for the status

    const col1X = tableLeftMargin;
    const col2X = col1X + col1Width;
    const col3X = col2X + col2Width;
    const col4X = col3X + col3Width;

    // Dessiner l'en-tête du tableau
    page.drawRectangle({
      x: col1X,
      y: currentY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      borderColor: espiGray,
      borderWidth: 1,
      color: espiBlue, // Blue for header
    });

    // Colonnes de l'en-tête
    // Update the column dividers
    page.drawLine({
      start: { x: col2X, y: currentY },
      end: { x: col2X, y: currentY - rowHeight },
      thickness: 1,
      color: espiGray,
    });

    page.drawLine({
      start: { x: col3X, y: currentY },
      end: { x: col3X, y: currentY - rowHeight },
      thickness: 1,
      color: espiGray,
    });

    page.drawLine({
      start: { x: col4X, y: currentY },
      end: { x: col4X, y: currentY - rowHeight },
      thickness: 1,
      color: espiGray,
    });

    // Texte de l'en-tête
    const enseignementsText = "Enseignements";
    const enseignementsWidth = boldFont.widthOfTextAtSize(enseignementsText, fontSize);
    const col1Center = col1X + col1Width / 2 - enseignementsWidth / 2;

    page.drawText(enseignementsText, {
      x: col1Center,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    const moyenneText = "Moyenne";
    const moyenneWidth = boldFont.widthOfTextAtSize(moyenneText, fontSize);
    const col2Center = col2X + col2Width / 2 - moyenneWidth / 2;

    page.drawText(moyenneText, {
      x: col2Center,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    const ectsText = "Total ECTS";
    const ectsWidth = boldFont.widthOfTextAtSize(ectsText, fontSize);
    const col3Center = col3X + col3Width / 2 - ectsWidth / 2;

    page.drawText(ectsText, {
      x: col3Center,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    const etatText = "État";
    const etatWidth = boldFont.widthOfTextAtSize(etatText, fontSize);
    const col4Center = col4X + col4Width / 2 - etatWidth / 2;

    page.drawText(etatText, {
      x: col4Center,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    currentY -= rowHeight;

    // Lignes pour chaque matière
    // ✅ Construction complète des matières à afficher (avec ou sans note)
    const allSubjects: Array<{
      CODE_MATIERE: string;
      NOM_MATIERE: string;
      MOYENNE?: number;
      CREDIT_ECTS: number;
      NUM_ORDRE: string;
    }> = subjects
      .filter((subject) => subject.CODE_APPRENANT === student.CODE_APPRENANT)
      .map((subject) => {
        const note = grades.find(
          (g) =>
            g.CODE_APPRENANT === student.CODE_APPRENANT && g.CODE_MATIERE === subject.CODE_MATIERE
        );

        return {
          CODE_MATIERE: subject.CODE_MATIERE,
          NOM_MATIERE: subject.NOM_MATIERE,
          MOYENNE: note ? note.MOYENNE : undefined,
          CREDIT_ECTS: subject.CREDIT_ECTS || 0,
          NUM_ORDRE: subject.NUM_ORDRE || "999",
        };
      })
      .sort((a, b) => parseInt(a.NUM_ORDRE, 10) - parseInt(b.NUM_ORDRE, 10));

    // Puis utilisez allSubjects pour mettre à jour les ECTS
    for (const subject of allSubjects) {
      // Mettre à 0 les ECTS des matières sans note/état
      if (
        !subject.NOM_MATIERE.startsWith("UE") &&
        subject.MOYENNE === undefined &&
        !matiereEtats.has(subject.CODE_MATIERE)
      ) {
        subject.CREDIT_ECTS = 0;
        console.log(`Mise à jour ECTS à 0 pour matière sans note/état: ${subject.NOM_MATIERE}`);
      }
    }

    // Recalculer les ECTS des UEs en fonction des matières
    const ueEctsMap = new Map<string, number>();

    // Initialiser les totaux à 0
    for (const [ueCode] of ueMap) {
      ueEctsMap.set(ueCode, 0);
    }

    // Calculer la somme des ECTS pour chaque UE
    for (const subject of allSubjects) {
      if (!subject.NOM_MATIERE.startsWith("UE") && matiereToUeMap.has(subject.CODE_MATIERE)) {
        const ueCode = matiereToUeMap.get(subject.CODE_MATIERE);
        if (ueCode !== undefined) {
          const ects = Number(subject.CREDIT_ECTS) || 0;
          const currentTotal = ueEctsMap.get(ueCode) || 0;
          ueEctsMap.set(ueCode, currentTotal + ects);
          console.log(
            `Recalcul ECTS : Ajout de ${ects} ECTS de ${subject.NOM_MATIERE} au total de l'UE ${ueCode}`
          );
        }
      }
    }

    // Mettre à jour les ECTS des UEs
    for (const subject of allSubjects) {
      if (subject.NOM_MATIERE.startsWith("UE")) {
        for (const [ueCode] of ueMap) {
          if (subject.CODE_MATIERE === ueCode) {
            const newEcts = ueEctsMap.get(ueCode) || 0;
            console.log(
              `Mise à jour des ECTS pour UE ${subject.NOM_MATIERE}: ancien=${subject.CREDIT_ECTS}, nouveau=${newEcts}`
            );
            subject.CREDIT_ECTS = newEcts;
            break;
          }
        }
      }
    }

    for (const subject of allSubjects) {
      const isUE = subject.NOM_MATIERE.startsWith("UE");

      // Définir la couleur de fond
      const backgroundColor = isUE ? espiGray : undefined;

      // Nouvelle ligne (avec ou sans fond)
      page.drawRectangle({
        x: col1X,
        y: currentY - rowHeight,
        width: tableWidth,
        height: rowHeight,
        borderColor: espiGray,
        borderWidth: 1,
        color: backgroundColor, // 👉 Applique le fond si c'est une UE
      });

      // Lignes verticales
      page.drawLine({
        start: { x: col2X, y: currentY },
        end: { x: col2X, y: currentY - rowHeight },
        thickness: 1,
        color: espiGray,
      });
      page.drawLine({
        start: { x: col3X, y: currentY },
        end: { x: col3X, y: currentY - rowHeight },
        thickness: 1,
        color: espiGray,
      });
      page.drawLine({
        start: { x: col4X, y: currentY },
        end: { x: col4X, y: currentY - rowHeight },
        thickness: 1,
        color: espiGray,
      });

      // Texte matière
      page.drawText(subject.NOM_MATIERE, {
        x: col1X + 5,
        y: currentY - 15,
        size: fontSize,
        font: isUE ? boldFont : mainFont, // 👉 Texte en gras si UE
        color: rgb(0, 0, 0),
      });

      // Moyenne (ou "-" si vide)
      // Moyenne (ou "-" si vide)
      // Moyenne (ou "-" si vide)
      let moyenne;
      if (subject.MOYENNE !== undefined && subject.MOYENNE !== null) {
        const moyenneStr = String(subject.MOYENNE);
        if (moyenneStr === "VA" || moyenneStr === "NV") {
          moyenne = moyenneStr;
          if (!matiereEtats.has(subject.CODE_MATIERE)) {
            matiereEtats.set(subject.CODE_MATIERE, moyenneStr);
          }
        } else if (moyenneStr === "-") {
          moyenne = "-";
          if (!matiereEtats.has(subject.CODE_MATIERE)) {
            matiereEtats.set(subject.CODE_MATIERE, "NV");
          }
        } else {
          try {
            moyenne = parseFloat(moyenneStr.replace(",", ".")).toFixed(2).replace(".", ",");
          } catch {
            moyenne = "-";
            if (!matiereEtats.has(subject.CODE_MATIERE)) {
              matiereEtats.set(subject.CODE_MATIERE, "NV");
            }
          }
        }
      } else {
        moyenne = "-";
        let note = notes?.find(
          (n) =>
            n.CODE_APPRENANT === student.CODE_APPRENANT && n.CODE_MATIERE === subject.CODE_MATIERE
        );
        if (!note) {
          note = notes?.find(
            (n) =>
              n.CODE_APPRENANT === student.CODE_APPRENANT && n.NOM_MATIERE === subject.NOM_MATIERE
          );
        }
        if (note) {
          if (Number(note.CODE_EVALUATION_NOTE) === 1) {
            moyenne = "VA";
            matiereEtats.set(subject.CODE_MATIERE, "VA");
          } else if (Number(note.CODE_EVALUATION_NOTE) === 2) {
            moyenne = "NV";
            matiereEtats.set(subject.CODE_MATIERE, "NV");
          }
        } else {
          if (!matiereEtats.has(subject.CODE_MATIERE)) {
            const moyenneTextuelle = String(subject.MOYENNE || "")
              .toUpperCase()
              .trim();
            if (["VA", "NV", "R", "C"].includes(moyenneTextuelle)) {
              matiereEtats.set(subject.CODE_MATIERE, moyenneTextuelle);
              console.log(
                `✅ Rattrapage depuis moyenne brute pour ${subject.NOM_MATIERE} → ${moyenneTextuelle}`
              );
            } else {
              matiereEtats.set(subject.CODE_MATIERE, "NV");
              console.warn(`⚠️ Matière sans état défini, forcée à NV : ${subject.NOM_MATIERE}`);
            }
          }
        }
      }

      const moyenneWidth = mainFont.widthOfTextAtSize(moyenne, fontSize);
      page.drawText(moyenne, {
        x: col2X + col2Width / 2 - moyenneWidth / 2,
        y: currentY - 15,
        size: fontSize,
        font: isUE ? boldFont : mainFont,
        color: rgb(0, 0, 0),
      });

      // État
      let etat = "-";

      // Si c'est une UE, on utilise l'état calculé depuis ueEtats
      if (subject.NOM_MATIERE.startsWith("UE")) {
        etat = ueEtats.get(subject.CODE_MATIERE) || "NV";
      } else {
        const etatCalculé = matiereEtats.get(subject.CODE_MATIERE);

        if (etatCalculé !== undefined) {
          etat = etatCalculé;
        } else {
          // Convertir la moyenne en chaîne pour faciliter les comparaisons
          const moyenneStr =
            subject.MOYENNE !== undefined && subject.MOYENNE !== null
              ? String(subject.MOYENNE)
              : "-";

          // Si aucun état n'a été calculé, vérifier d'abord si la moyenne est "VA" ou "NV" directement
          if (moyenneStr === "VA") {
            etat = "VA";
          } else if (moyenneStr === "NV") {
            etat = "NV";

            // AJOUT: Forcer l'UE parente à NV
            if (!subject.NOM_MATIERE.startsWith("UE")) {
              // Utilisez subject au lieu de matiere
              const ueCode = matiereToUeMap.get(subject.CODE_MATIERE); // Utilisez subject au lieu de matiere
              if (ueCode) {
                ueEtats.set(ueCode, "NV");
                console.log(
                  `UE ${ueCode} forcée à NV car matière ${subject.NOM_MATIERE} a moyenne NV` // Utilisez subject au lieu de matiere
                );
              }
            }
          } else if (moyenneStr === "-") {
            etat = "NV"; // Si la moyenne est "-", l'état est "NV"
          } else {
            // Ensuite chercher dans les notes
            let note = notes?.find(
              (n) =>
                n.CODE_APPRENANT === student.CODE_APPRENANT &&
                n.CODE_MATIERE === subject.CODE_MATIERE
            );

            // Si aucune note trouvée par CODE_MATIERE, essayer par NOM_MATIERE
            if (!note) {
              note = notes?.find(
                (n) =>
                  n.CODE_APPRENANT === student.CODE_APPRENANT &&
                  n.NOM_MATIERE === subject.NOM_MATIERE
              );
            }

            if (note) {
              if (Number(note.CODE_EVALUATION_NOTE) === 1) {
                etat = "VA";
              } else if (Number(note.CODE_EVALUATION_NOTE) === 2) {
                etat = "NV";
              }
            } else {
              // Si aucune note n'est trouvée, vérifier si une moyenne existe et est numérique
              try {
                const moyenneValue = parseFloat(moyenneStr.replace(",", "."));
                if (!isNaN(moyenneValue)) {
                  etat = moyenneValue >= 10 ? "VA" : "NV";
                } else {
                  etat = "NV"; // Si la moyenne existe mais n'est pas numérique
                }
              } catch (error) {
                etat = "NV"; // En cas d'erreur de conversion
                console.log(
                  `Erreur lors de la conversion de la moyenne pour ${subject.NOM_MATIERE}:`,
                  error
                );
              }
            }
          }

          // Ajout d'un log de sécurité
          console.warn(
            `⚠️ Aucun état trouvé pour ${subject.NOM_MATIERE} (${subject.CODE_MATIERE}), valeur par défaut: ${etat}.`
          );
        }
      }

      // Mettre à jour les ECTS à 0 si état est "NV" ou "R" et ce n'est pas une UE
      if ((etat === "NV" || etat === "R") && !subject.NOM_MATIERE.startsWith("UE")) {
        subject.CREDIT_ECTS = 0;
        console.log(`Mise à jour ECTS à 0 pour matière avec état ${etat}: ${subject.NOM_MATIERE}`);
      }

      // ECTS - Utilisez directement subject.CREDIT_ECTS qui peut avoir été mis à jour
      const ects = subject.CREDIT_ECTS.toString();
      const ectsWidth = mainFont.widthOfTextAtSize(ects, fontSize);
      page.drawText(ects, {
        x: col3X + col3Width / 2 - ectsWidth / 2,
        y: currentY - 15,
        size: fontSize,
        font: isUE ? boldFont : mainFont,
        color: rgb(0, 0, 0),
      });

      // Sélectionner la police en fonction de l'état
      const etatFont = isUE ? boldFont : etat === "R" || etat === "C" ? boldFont : mainFont;

      // Déterminer la couleur selon l'état
      let etatColor;
      if (etat === "R") {
        etatColor = rgb(0.93, 0.43, 0.41); // #ed6d68 en RGB pour "R"
      } else if (etat === "C") {
        etatColor = rgb(0.04, 0.36, 0.51); // #156082 en RGB pour "C"
      } else {
        etatColor = rgb(0, 0, 0); // Noir pour les autres états
      }

      const etatWidth = mainFont.widthOfTextAtSize(etat, fontSize);
      page.drawText(etat, {
        x: col4X + col4Width / 2 - etatWidth / 2,
        y: currentY - 15,
        size: fontSize,
        font: etatFont, // Utiliser etatFont au lieu de mainFont
        color: etatColor, // Utiliser etatColor au lieu de rgb(0, 0, 0)
      });
      currentY -= rowHeight;

      // Saut de page si nécessaire
      if (currentY < margin + rowHeight) {
        page = pdfDoc.addPage([595.28, 841.89]);
        currentY = pageHeight - margin;
      }
    }

    // Ligne pour la moyenne générale
    page.drawRectangle({
      x: col1X,
      y: currentY - rowHeight,
      width: tableWidth,
      height: rowHeight,
      borderColor: espiBlue,
      borderWidth: 1,
      color: espiBlue,
    });

    // Vertical lines
    page.drawLine({
      start: { x: col2X, y: currentY },
      end: { x: col2X, y: currentY - rowHeight },
      thickness: 1,
      color: espiGray,
    });

    page.drawLine({
      start: { x: col3X, y: currentY },
      end: { x: col3X, y: currentY - rowHeight },
      thickness: 1,
      color: espiGray,
    });

    page.drawLine({
      start: { x: col4X, y: currentY },
      end: { x: col4X, y: currentY - rowHeight },
      thickness: 1,
      color: espiGray,
    });

    // Text "Moyenne générale"
    page.drawText("Moyenne générale", {
      x: col1X + 5,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // Valeur de la moyenne générale
    const studentAverage = averages.find((avg) => avg.CODE_APPRENANT === student.CODE_APPRENANT);
    let moyenneGenerale = "N/A";

    if (studentAverage) {
      try {
        const moyenneGeneraleRaw = studentAverage.MOYENNE_GENERALE as any;
        const moyenneGeneraleValue =
          typeof moyenneGeneraleRaw === "string"
            ? parseFloat(moyenneGeneraleRaw.replace(",", "."))
            : moyenneGeneraleRaw;

        if (moyenneGeneraleValue !== null && !isNaN(moyenneGeneraleValue)) {
          moyenneGenerale =
            typeof moyenneGeneraleValue.toFixed === "function"
              ? moyenneGeneraleValue.toFixed(2).replace(".", ",") // ← Ajout du .replace(".", ",")
              : moyenneGeneraleValue.toString();
        }
      } catch (error) {
        console.log("Erreur lors du formatage de la moyenne générale:", error);
      }
    }

    // Center the general average
    const moyenneGeneraleWidth = mainFont.widthOfTextAtSize(moyenneGenerale, fontSize);
    const moyenneGeneraleCenterX = col2X + col2Width / 2 - moyenneGeneraleWidth / 2;

    page.drawText(moyenneGenerale, {
      x: moyenneGeneraleCenterX,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    // ✅ Correction : Calcul du total des ECTS basé uniquement sur les UE

    // ✅ Vérification et correction du calcul du total des ECTS
    const totalECTS = allSubjects
      .filter((subject) => subject.NOM_MATIERE.startsWith("UE"))
      .reduce((acc, subject) => acc + (subject.CREDIT_ECTS || 0), 0);
    console.log("Total ECTS (UE uniquement) :", totalECTS);

    // Log détaillé pour le débogage
    console.log("Détail des UE pour l'étudiant " + student.CODE_APPRENANT + ":");
    subjects
      .filter(
        (subject) =>
          subject.CODE_APPRENANT === student.CODE_APPRENANT &&
          subject.NOM_MATIERE &&
          subject.NOM_MATIERE.startsWith("UE")
      )
      .forEach((ue) => {
        console.log(`${ue.NOM_MATIERE}: ${ue.CREDIT_ECTS} ECTS`);
      });

    const totalECTSText = String(Number(totalECTS) || 0);
    const totalECTSWidth = mainFont.widthOfTextAtSize(totalECTSText, fontSize);
    const totalECTSCenterX = col3X + col3Width / 2 - totalECTSWidth / 2;

    // ✅ Ajout du texte proprement
    page.drawText(totalECTSText, {
      x: totalECTSCenterX,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    const getEtatGeneral = (
      subjects: SubjectECTS[],
      studentId: string,
      ueEtats: Map<string, string>
    ): string => {
      const ueSubjects = subjects.filter(
        (subject) =>
          subject.CODE_APPRENANT === studentId &&
          subject.NOM_MATIERE &&
          subject.NOM_MATIERE.startsWith("UE")
      );

      if (ueSubjects.length === 0) return "NV";

      // Si au moins une UE est en NV → état général = NV
      for (const ue of ueSubjects) {
        const etatUE = ueEtats.get(ue.CODE_MATIERE);
        if (etatUE !== "VA") {
          return "NV";
        }
      }

      return ueSubjects.every((ue) => ueEtats.get(ue.CODE_MATIERE) === "VA") ? "VA" : "NV";
    };

    // État général (Validé ou Non Validé)
    const etatGeneral = getEtatGeneral(subjects, student.CODE_APPRENANT, ueEtats);
    const etatGeneralWidth = mainFont.widthOfTextAtSize(etatGeneral, fontSize);
    const etatGeneralCenterX = col4X + col4Width / 2 - etatGeneralWidth / 2;

    page.drawText(etatGeneral, {
      x: etatGeneralCenterX,
      y: currentY - 15,
      size: fontSize,
      font: boldFont,
      color: rgb(1, 1, 1),
    });

    currentY -= rowHeight + 10;

    // Section absences et observations
    const boxWidthABS = pageWidth - 2 * margin;
    const boxHeightABS = 40;

    // Dessiner le rectangle principal
    page.drawRectangle({
      x: margin,
      y: currentY - boxHeightABS,
      width: boxWidthABS,
      height: boxHeightABS,
      borderColor: espiBlue,
      borderWidth: 1,
    });

    // Lignes verticales pour diviser en trois colonnes
    page.drawLine({
      start: { x: margin + boxWidthABS / 3, y: currentY },
      end: { x: margin + boxWidthABS / 3, y: currentY - boxHeightABS },
      thickness: 1,
      color: espiBlue,
    });

    page.drawLine({
      start: { x: margin + (2 * boxWidthABS) / 3, y: currentY },
      end: { x: margin + (2 * boxWidthABS) / 3, y: currentY - boxHeightABS },
      thickness: 1,
      color: espiBlue,
    });

    // Filtrer les absences de l'étudiant en cours
    const studentAbsence = processedABS.find(
      (abs) => abs.CODE_APPRENANT === student.CODE_APPRENANT
    );

    // Si on trouve des absences, on les affiche
    if (studentAbsence) {
      const absJustText = "Absences justifiées";
      const absJustWidth = mainFont.widthOfTextAtSize(absJustText, fontSize);
      const colWidth = boxWidthABS / 3;

      page.drawText(absJustText, {
        x: margin + colWidth / 2 - absJustWidth / 2, // Centré dans la colonne
        y: currentY - 15,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Valeur Absences justifiées
      const absJustValue = studentAbsence.ABSENCES_JUSTIFIEES;
      const absJustValueWidth = mainFont.widthOfTextAtSize(absJustValue, fontSize);

      page.drawText(absJustValue, {
        x: margin + colWidth / 2 - absJustValueWidth / 2, // Centré dans la colonne
        y: currentY - 30,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Titre "Absences injustifiées" dans la deuxième colonne
      const absInjText = "Absences injustifiées";
      const absInjWidth = mainFont.widthOfTextAtSize(absInjText, fontSize);

      page.drawText(absInjText, {
        x: margin + colWidth + colWidth / 2 - absInjWidth / 2, // Centré dans la colonne
        y: currentY - 15,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Valeur Absences injustifiées
      const absInjValue = studentAbsence.ABSENCES_INJUSTIFIEES;
      const absInjValueWidth = mainFont.widthOfTextAtSize(absInjValue, fontSize);

      page.drawText(absInjValue, {
        x: margin + colWidth + colWidth / 2 - absInjValueWidth / 2, // Centré dans la colonne
        y: currentY - 30,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Titre "Retards" dans la troisième colonne
      const retardsText = "Retards";
      const retardsWidth = mainFont.widthOfTextAtSize(retardsText, fontSize);

      page.drawText(retardsText, {
        x: margin + 2 * colWidth + colWidth / 2 - retardsWidth / 2, // Centré dans la colonne
        y: currentY - 15,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Valeur Retards
      const retardsValue = studentAbsence.RETARDS;
      const retardsValueWidth = mainFont.widthOfTextAtSize(retardsValue, fontSize);

      page.drawText(retardsValue, {
        x: margin + 2 * colWidth + colWidth / 2 - retardsValueWidth / 2, // Centré dans la colonne
        y: currentY - 30,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });
    } else {
      // SI AUCUNE ABSENCE N'EST TROUVÉE, AFFICHER LES VALEURS PAR DÉFAUT
      // Titre "Absences justifiées" dans la première colonne
      const absJustText = "Absences justifiées";
      const absJustWidth = mainFont.widthOfTextAtSize(absJustText, fontSize);
      const colWidth = boxWidthABS / 3;

      page.drawText(absJustText, {
        x: margin + colWidth / 2 - absJustWidth / 2, // Centré dans la colonne
        y: currentY - 15,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Valeur par défaut
      const defaultValue = "00h00";
      const defaultValueWidth = mainFont.widthOfTextAtSize(defaultValue, fontSize);

      page.drawText(defaultValue, {
        x: margin + colWidth / 2 - defaultValueWidth / 2, // Centré dans la colonne
        y: currentY - 30,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Titre "Absences injustifiées" dans la deuxième colonne
      const absInjText = "Absences injustifiées";
      const absInjWidth = mainFont.widthOfTextAtSize(absInjText, fontSize);

      page.drawText(absInjText, {
        x: margin + colWidth + colWidth / 2 - absInjWidth / 2, // Centré dans la colonne
        y: currentY - 15,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Valeur par défaut
      page.drawText(defaultValue, {
        x: margin + colWidth + colWidth / 2 - defaultValueWidth / 2, // Centré dans la colonne
        y: currentY - 30,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Titre "Retards" dans la troisième colonne
      const retardsText = "Retards";
      const retardsWidth = mainFont.widthOfTextAtSize(retardsText, fontSize);

      page.drawText(retardsText, {
        x: margin + 2 * colWidth + colWidth / 2 - retardsWidth / 2, // Centré dans la colonne
        y: currentY - 15,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      // Valeur par défaut
      page.drawText(defaultValue, {
        x: margin + 2 * colWidth + colWidth / 2 - defaultValueWidth / 2, // Centré dans la colonne
        y: currentY - 30,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });
    }

    currentY -= boxHeightABS + 15;

    // Observations
    const studentObservation = observations.find(
      (obs) => obs.CODE_APPRENANT === student.CODE_APPRENANT
    );

    if (studentObservation) {
      page.drawText("Appréciations :", {
        x: col1X,
        y: currentY,
        size: fontSize,
        font: mainFont,
        color: espiBlue,
      });

      currentY -= 15;

      // Nettoyer et normaliser le texte d'observation
      let observationText = "";
      try {
        observationText = studentObservation.MEMO_OBSERVATION || "";
        observationText = observationText.replace(/\r/g, " ");
        observationText = observationText.replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
      } catch (error) {
        console.log("Erreur lors du nettoyage du texte d'observation:", error);
        observationText = "Observations non disponibles en raison d'un problème d'encodage.";
      }

      // Découper le texte en lignes
      const maxWidth = pageWidth - 2 * margin;
      const words = observationText.split(" ");
      let line = "";

      for (const word of words) {
        try {
          const testLine = line + (line ? " " : "") + word;
          const textWidth = mainFont.widthOfTextAtSize(testLine, fontSize);

          if (textWidth > maxWidth) {
            page.drawText(line, {
              x: col1X,
              y: currentY,
              size: fontSize,
              font: mainFont,
              color: espiBlue,
            });

            line = word;
            currentY -= 12;

            if (currentY < margin) {
              // Ajouter une nouvelle page - CORRIGÉ
              page = pdfDoc.addPage([595.28, 841.89]);
              currentY = pageHeight - margin;
            }
          } else {
            line = testLine;
          }
        } catch (error) {
          console.log(`Erreur lors du traitement du mot "${word}":`, error);
          continue;
        }
      }

      // Dessiner la dernière ligne
      if (line) {
        page.drawText(line, {
          x: col1X,
          y: currentY,
          size: fontSize,
          font: mainFont,
          color: espiBlue,
        });
      }
    }

    currentY -= 15; // Espace additionnel

    // Vérifier s'il reste assez d'espace pour la signature
    const MIN_SPACE_FOR_SIGNATURE = 70;
    if (currentY < margin + MIN_SPACE_FOR_SIGNATURE) {
      // Pas assez d'espace, créer une nouvelle page
      page = pdfDoc.addPage([595.28, 841.89]);
      currentY = pageHeight - margin;
    }

    // Placer la signature à la position courante
    const signatureY = currentY - 5;

    // Texte du lieu et de la date
    page.drawText(
      `Fait à ${campus ? campus.NOM_SITE : "Paris"}, le ${new Date().toLocaleDateString("fr-FR")}`,
      {
        x: pageWidth - margin - 200,
        y: signatureY,
        size: 7,
        font: mainFont,
      }
    );

    // Récupérer le code personnel du gestionnaire à partir du groupe si disponible
    let codePersonnel = "";
    let nomPersonnel = "";
    let prenomPersonnel = "";
    let nomFonctionPersonnel = "";

    // Vérifier si les données PERSONNEL sont disponibles
    console.log("PERSONNEL data:", personnelData);
    console.log("groupInfo:", groupInfo);

    // Vérifier d'abord si les données sont disponibles directement dans groupInfo
    if (groupInfo.length > 0) {
      codePersonnel = groupInfo[0].CODE_PERSONNEL || "";
      nomPersonnel = groupInfo[0].NOM_PERSONNEL || "";
      prenomPersonnel = groupInfo[0].PRENOM_PERSONNEL || "";
      nomFonctionPersonnel = groupInfo[0].NOM_FONCTION_PERSONNEL || "";

      console.log("From groupInfo:", {
        code: codePersonnel,
        nom: nomPersonnel,
        prenom: prenomPersonnel,
        fonction: nomFonctionPersonnel,
      });
    }

    // Si aucune donnée n'est disponible dans groupInfo, vérifier si PERSONNEL est disponible
    if ((!nomPersonnel || !prenomPersonnel) && personnelData && personnelData.length > 0) {
      const personnel = personnelData[0];
      codePersonnel = personnel.CODE_PERSONNEL || "";
      nomPersonnel = personnel.NOM_PERSONNEL || "";
      prenomPersonnel = personnel.PRENOM_PERSONNEL || "";
      nomFonctionPersonnel = personnel.NOM_FONCTION_PERSONNEL || "";

      console.log("From PERSONNEL data:", {
        code: codePersonnel,
        nom: nomPersonnel,
        prenom: prenomPersonnel,
        fonction: nomFonctionPersonnel,
      });
    }

    // Fallback si toujours aucune donnée
    if (!nomPersonnel) nomPersonnel = "Responsable";
    if (!prenomPersonnel) prenomPersonnel = "Pédagogique";
    if (!nomFonctionPersonnel) nomFonctionPersonnel = "Responsable Pédagogique";
    if (!codePersonnel && campus && campus.CODE_PERSONNEL) {
      codePersonnel = campus.CODE_PERSONNEL;
    }

    // Debug log
    console.log("Final signature data:", {
      code: codePersonnel,
      nom: nomPersonnel,
      prenom: prenomPersonnel,
      fonction: nomFonctionPersonnel,
    });

    // Obtenir le nom du fichier de signature correspondant au code personnel
    const signatureFilename = getSignatureFilename(codePersonnel);
    console.log(`Searching signature for code ${codePersonnel}, found: ${signatureFilename}`);

    // Si un fichier de signature est disponible pour ce code personnel
    // Si un fichier de signature est disponible pour ce code personnel
    if (signatureFilename) {
      try {
        // Déterminer l'extension du fichier pour choisir la méthode d'intégration appropriée
        const isJpg =
          signatureFilename.toLowerCase().endsWith(".jpg") ||
          signatureFilename.toLowerCase().endsWith(".jpeg");

        // Chemin vers l'image de signature
        const signaturePath = path.join(process.cwd(), "public", "signatures", signatureFilename);
        console.log(`Looking for signature at: ${signaturePath}`);
        const signatureBytes = fs.readFileSync(signaturePath);

        // Intégrer l'image selon son format
        let signatureImage;
        if (isJpg) {
          signatureImage = await pdfDoc.embedJpg(signatureBytes);
        } else {
          signatureImage = await pdfDoc.embedPng(signatureBytes);
        }

        // Obtenir les dimensions de l'image et la redimensionner si nécessaire
        const originalWidth = signatureImage.width;
        let scale = 0.2; // Échelle par défaut

        // Ajuster l'échelle en fonction de la largeur de l'image
        if (originalWidth > 400) scale = 0.15;
        else if (originalWidth < 200) scale = 0.35;

        // Ajouter une limite de taille maximale pour la signature
        const MAX_WIDTH = 120; // Limite la signature à 120 points de large
        const scaleByWidth = signatureImage.scale(scale);
        let finalScale = scale;

        // Si même avec notre échelle la signature est trop large, réduire davantage
        if (scaleByWidth.width > MAX_WIDTH) {
          finalScale = scale * (MAX_WIDTH / scaleByWidth.width);
        }

        const signatureDims = signatureImage.scale(finalScale);

        // D'abord dessiner l'image de signature
        page.drawText(`Signature du ${nomFonctionPersonnel}`, {
          x: pageWidth - margin - 200,
          y: signatureY - 15,
          size: 7,
          font: mainFont,
        });

        // Afficher le prénom et nom inversés en gras après le texte fonction, mais avant l'image
        page.drawText(`${prenomPersonnel} ${nomPersonnel}`, {
          // Inverser nom et prénom
          x: pageWidth - margin - 200,
          y: signatureY - 27,
          size: 7,
          font: boldFont,
        });

        // Puis dessiner l'image de signature sous les textes
        page.drawImage(signatureImage, {
          x: pageWidth - margin - 200,
          y: signatureY - 40 - signatureDims.height,
          width: signatureDims.width,
          height: signatureDims.height,
        });
      } catch (error) {
        console.error(
          `Erreur lors du chargement de l'image de signature ${signatureFilename}:`,
          error
        );

        // En cas d'erreur, revenir à la signature textuelle
        page.drawText(`Signature du : ${nomFonctionPersonnel}`, {
          x: pageWidth - margin - 200,
          y: signatureY - 10,
          size: 7,
          font: mainFont,
        });

        page.drawText(`${prenomPersonnel} ${nomPersonnel}`, {
          // Inverser nom et prénom
          x: pageWidth - margin - 200,
          y: signatureY - 22,
          size: 7,
          font: boldFont,
        });

        // Afficher le code personnel
        page.drawText(`Code personnel: ${codePersonnel}`, {
          x: pageWidth - margin - 200,
          y: signatureY - 34,
          size: 7,
          font: mainFont,
        });
      }
    } else {
      // Pour les codes personnels sans signature, afficher uniquement le texte
      page.drawText(`Signature du : ${nomFonctionPersonnel}`, {
        x: pageWidth - margin - 200,
        y: signatureY - 10,
        size: fontSize,
        font: mainFont,
      });

      page.drawText(`${prenomPersonnel} ${nomPersonnel}`, {
        // Inverser nom et prénom
        x: pageWidth - margin - 200,
        y: signatureY - 22,
        size: fontSize,
        font: boldFont,
      });
    }

    // Déplacer la légende en pied de page
    const footerY = 25; // Position plus basse pour la légende
    page.drawText("VA : Validé / NV : Non Validé / C : Compensation / R : Rattrapage", {
      // Ajout d'espaces avant les deux points
      x: margin,
      y: footerY,
      size: 7,
      font: mainFont,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Serialize the PDF document
    const pdfBytes = await pdfDoc.save();
    return pdfBytes;
  } catch (error) {
    console.error("Erreur lors de la création du PDF:", error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Parse the request body
    const body = await req.json();
    console.log("Génération de PDF - Corps de la requête reçue:", body);

    if (body.data) {
      console.log("Structure des données:");
      console.log("APPRENANT:", body.data.APPRENANT?.length || 0);
      console.log("MOYENNES_UE:", body.data.MOYENNES_UE?.length || 0);
      console.log("MOYENNE_GENERALE:", body.data.MOYENNE_GENERALE?.length || 0);
      console.log("OBSERVATIONS:", body.data.OBSERVATIONS?.length || 0);
      console.log("ECTS_PAR_MATIERE:", body.data.ECTS_PAR_MATIERE?.length || 0);
      console.log("MATIERE:", body.data.MATIERE?.length || 0);
      console.log("GROUPE:", body.data.GROUPE?.length || 0);
      console.log("SITE:", body.data.SITE?.length || 0);

      // Log the UE and associated subjects if MATIERE data is available
      if (body.data.MATIERE && body.data.MATIERE.length > 0) {
        console.log("Analyse des relations UE-Matières avant traitement:");
        logUEWithSubjects(body.data.MATIERE);
      } else {
        console.log("⚠️ Aucune donnée MATIERE disponible pour le log UE/Matières.");
      }
    } else {
      console.log("Aucune donnée reçue!");
    }

    // Extract data from the request
    // Vérifie si les données sont bien présentes
    if (!body?.data || !body?.periodeEvaluation || !body?.groupName) {
      return NextResponse.json(
        { error: "Données manquantes pour la génération PDF" },
        { status: 400 }
      );
    }

    const { data, periodeEvaluation, groupName } = body;

    if (!data || !periodeEvaluation || !groupName) {
      return NextResponse.json(
        { error: "Certains paramètres sont manquants (data, periodeEvaluation ou groupName)" },
        { status: 400 }
      );
    }

    console.log("📥 Requête reçue pour génération PDF");
    console.log("🧠 Groupe :", groupName);
    console.log("📅 Période :", periodeEvaluation);

    // Check if we have student data
    // Examiner la structure des données
    if (data.APPRENANT && data.APPRENANT.length > 0) {
      console.log("Structure détaillée du premier étudiant:");
      console.log(JSON.stringify(data.APPRENANT[0], null, 2));
    }

    if (data.MOYENNES_UE && data.MOYENNES_UE.length > 0) {
      console.log("Structure détaillée de la première moyenne UE:");
      console.log(JSON.stringify(data.MOYENNES_UE[0], null, 2));
      console.log("Type de MOYENNE:", typeof data.MOYENNES_UE[0].MOYENNE);
      console.log("Valeur de MOYENNE:", data.MOYENNES_UE[0].MOYENNE);
    }

    if (data.MOYENNE_GENERALE && data.MOYENNE_GENERALE.length > 0) {
      console.log("Structure détaillée de la première moyenne générale:");
      console.log(JSON.stringify(data.MOYENNE_GENERALE[0], null, 2));
      console.log("Type de MOYENNE_GENERALE:", typeof data.MOYENNE_GENERALE[0].MOYENNE_GENERALE);
      console.log("Valeur de MOYENNE_GENERALE:", data.MOYENNE_GENERALE[0].MOYENNE_GENERALE);
    }

    if (data.ECTS_PAR_MATIERE && data.ECTS_PAR_MATIERE.length > 0) {
      const uniqueCount = new Set(
        data.ECTS_PAR_MATIERE.map((item: any) => `${item.CODE_APPRENANT}_${item.CODE_MATIERE}`)
      ).size;
      console.log(
        `📊 ECTS_PAR_MATIERE: ${data.ECTS_PAR_MATIERE.length} éléments, ${uniqueCount} uniques`
      );
      console.log(`Nombre de matières avant traitement: ${data.ECTS_PAR_MATIERE.length}`);
      console.log(
        `📌 Ratio de duplication: ${(data.ECTS_PAR_MATIERE.length / uniqueCount).toFixed(2)}x`
      );
    }

    // Initialize ZIP archive in memory
    const zip = new JSZip();

    // Track failures
    let successCount = 0;
    let failureCount = 0;

    // Utiliser les données MATIERE si disponibles, sinon ECTS_PAR_MATIERE
    const sourceMatieres = data.MATIERE || data.ECTS_PAR_MATIERE || [];
    // Appliquer la règle : si une matière avec CODE_TYPE_MATIERE "3" a un état "R", ses ECTS passent à 0
    sourceMatieres.forEach((matiere: any) => {
      // Vérifier si la matière est en rattrapage
      if (matiere.CODE_TYPE_MATIERE !== "2" && matiere.ETAT === "R") {
        matiere.CREDIT_ECTS = 0; // Annuler les crédits si la matière est en rattrapage
        console.log(
          `Matière en rattrapage: ${matiere.NOM_MATIERE}, État: ${matiere.ETAT}, ECTS mis à 0`
        );
      } else {
        console.log(
          `Matière non affectée: ${matiere.NOM_MATIERE}, CODE_TYPE_MATIERE: ${matiere.CODE_TYPE_MATIERE}, ETAT: ${matiere.ETAT}, ECTS: ${matiere.CREDIT_ECTS}`
        );
      }
    });

    // Mise à jour des crédits UE avec la nouvelle fonction
    const updatedSubjects = updateUECredits(sourceMatieres);
    console.log(`✅ Crédits UE mis à jour (${updatedSubjects.length} matières traitées)`);

    // Par ceci:
    const startDateFromPeriod = "2024-08-26T00:00:00";
    const endDateFromPeriod = "2025-08-24T00:00:00";

    console.log(`Traitement des absences de ${startDateFromPeriod} à ${endDateFromPeriod}`);

    // Générer PDFs pour chaque étudiant
    for (const studentObj of data.APPRENANT) {
      try {
        // Extraire les données nécessaires de l'objet étudiant
        const student = {
          CODE_APPRENANT: studentObj.CODE_APPRENANT || "",
          NOM_APPRENANT: studentObj.NOM_APPRENANT || "",
          PRENOM_APPRENANT: studentObj.PRENOM_APPRENANT || "",
          DATE_NAISSANCE: studentObj.DATE_NAISSANCE || null,
        };

        console.log(`Création du PDF pour ${student.NOM_APPRENANT} ${student.PRENOM_APPRENANT}`);

        const updatedSubjects = updateUECredits(data.ECTS_PAR_MATIERE || []);
        console.log(`Nombre de matières après traitement: ${updatedSubjects.length}`);

        const pdfBytes = await createStudentPDF(
          student,
          data.MOYENNES_UE || [],
          data.MOYENNE_GENERALE || [],
          data.OBSERVATIONS || [],
          updatedSubjects,
          data.GROUPE || [],
          data.SITE || [],
          periodeEvaluation,
          data.ABSENCE || [],
          processAbsences(data.ABSENCE || [], startDateFromPeriod, endDateFromPeriod).students, // ✅ Ajouter .students
          data.PERSONNEL || [],
          data.NOTES || []
        );

        console.log("📌 Matières brutes reçues :", data.ECTS_PAR_MATIERE);

        // Par le code suivant:
        // Récupérer le nom de la formation à partir des données du groupe
        let nomFormation = "FORMATION";
        if (data.GROUPE && data.GROUPE.length > 0 && data.GROUPE[0].NOM_FORMATION) {
          nomFormation = data.GROUPE[0].NOM_FORMATION.replace(/\s+/g, "_").replace(
            /[^a-zA-Z0-9_-]/g,
            ""
          );
        }

        let nomAnnee = "ANNEE";
        if (data.MATIERE && data.MATIERE.length > 0) {
          // Chercher la première occurrence de MATIERE qui contient NOM_ANNEE
          const matiereWithAnnee = data.MATIERE.find((matiere: any) => matiere.NOM_ANNEE);
          if (matiereWithAnnee && matiereWithAnnee.NOM_ANNEE) {
            nomAnnee = matiereWithAnnee.NOM_ANNEE.replace(/\s+/g, "_").replace(
              /[\/\\:*?"<>|]/g,
              ""
            );
            console.log(`NOM_ANNEE trouvé dans MATIERE: "${nomAnnee}"`);
          }
        }

        // Nettoyer la période d'évaluation
        const periodClean = periodeEvaluation.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");

        // Générer le nom de fichier au format demandé
        const filename = `2024-2025_${nomFormation}_${nomAnnee}_${periodClean}_${student.NOM_APPRENANT}_${student.PRENOM_APPRENANT}.pdf`;

        // Add PDF to the zip file (in memory)
        zip.file(filename, pdfBytes);
        console.log(`Fichier ${filename} ajouté au ZIP`);

        successCount++;
        console.log(`📄 PDF généré pour ${student.NOM_APPRENANT} ${student.PRENOM_APPRENANT}`);
      } catch (error) {
        failureCount++;
        console.error(`❌ Erreur lors de la génération du PDF pour l'étudiant:`, error);
      }
    }

    if (successCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun PDF n'a pu être généré",
          details: `${failureCount} bulletins ont échoué`,
        },
        { status: 500 }
      );
    }

    // Generate ZIP in memory
    console.log(`Génération du ZIP pour ${successCount} PDFs`);
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });
    console.log("ZIP généré avec succès");

    let groupNameForFilename = groupName; // Valeur par défaut
    let periodNameForFilename = periodeEvaluation;
    // Valeur par défaut

    // Essayer de récupérer NOM_PERIODE_EVALUATION depuis les données des notes
    if (data.MOYENNES_UE && data.MOYENNES_UE.length > 0) {
      // Vérifier si le champ existe dans les données
      const sampleGrade = data.MOYENNES_UE[0];
      console.log("Exemple de données MOYENNES_UE:", sampleGrade);

      if (sampleGrade.NOM_PERIODE_EVALUATION) {
        periodNameForFilename = sampleGrade.NOM_PERIODE_EVALUATION;
        console.log(`NOM_PERIODE_EVALUATION trouvé: "${periodNameForFilename}"`);
      } else {
        console.log("NOM_PERIODE_EVALUATION non trouvé dans les données MOYENNES_UE");
        // Lister toutes les clés disponibles pour aider au débogage
        console.log("Clés disponibles:", Object.keys(sampleGrade));
      }
    }

    // 2. Récupérer le nom du groupe depuis les données
    if (data.GROUPE && data.GROUPE.length > 0) {
      groupNameForFilename = data.GROUPE[0].NOM_GROUPE || groupName;
      console.log(`NOM_GROUPE trouvé: "${groupNameForFilename}"`);
    }

    // Nettoyer et formater les variables du nom de groupe et de période
    // 3. Nettoyer et formater les valeurs pour le nom du fichier
    const sanitizedGroupName = groupNameForFilename
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");
    const sanitizedPeriod = periodNameForFilename
      .replace(/\s+/g, "_")
      .replace(/[^a-zA-Z0-9_-]/g, "");

    // Créer le nom du fichier ZIP avec le format demandé: bulletins_NOM_GROUPE_NOM_PERIODE_EVALUATION.zip
    const zipId = `bulletins_${sanitizedGroupName}_${sanitizedPeriod}.zip`;

    console.log(`ID du fichier ZIP généré: ${zipId}`);

    // Stocker le contenu dans notre système de stockage sur disque
    fileStorage.storeFile(zipId, Buffer.from(zipBuffer), "application/zip");
    console.log(`Fichier temporaire stocké: ${zipId}, taille: ${zipBuffer.byteLength} octets`);

    // Vérifier que le fichier est bien dans le store
    if (fileStorage.hasFile(zipId)) {
      console.log(`✅ Confirmation: le fichier ${zipId} existe dans le fileStorage`);
    } else {
      console.log(`❌ Erreur: le fichier ${zipId} n'existe PAS dans le fileStorage`);
      return NextResponse.json(
        {
          success: false,
          error: "Erreur lors du stockage du fichier ZIP",
        },
        { status: 500 }
      );
    }

    // Afficher tous les fichiers disponibles
    console.log(`Fichiers disponibles dans le store: ${fileStorage.getAllFileIds().join(", ")}`);

    const result = {
      path: `/api/download?id=${zipId}`, // le lien de téléchargement
      studentCount: body.data.APPRENANT?.length || 0,
    };

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("❌ Erreur génération PDF :", error);
    return NextResponse.json(
      { error: error.message || "Erreur inattendue lors de la génération des bulletins" },
      { status: 500 }
    );
  }
}
