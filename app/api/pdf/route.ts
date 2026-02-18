/* eslint-disable @typescript-eslint/no-explicit-any */
import { Etat, getEtatUE, getUeAverage, normalizeEtat, parseUeAverage } from "@/lib/bulletin/ue";
import { fileStorage } from "@/lib/fileStorage";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

// ============================================================
// INTERFACES
// ============================================================

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

// ============================================================
// ASSETS PRÉCHARGÉS (chargés une seule fois pour tous les PDFs)
// ============================================================

interface PreloadedAssets {
  logoBytes: Buffer;
  poppinsRegularBytes: Buffer | null;
  poppinsBoldBytes: Buffer | null;
  signatureCache: Map<string, Buffer>;
}

const SIGNATURE_MAP: Record<string, string> = {
  "460": "christine.jpg",
  "482": "ludivinelaunay.png",
  "500": "estelle.jpg",
  "517": "signYoussefSAKER.jpg",
  "2239": "marionsoustelle.png",
  "306975": "lebon.png",
  "89152": "magali.png",
  "650429": "Anne-Lise.png",
};

function preloadAssets(): PreloadedAssets {
  // Logo
  const logoPath = path.join(process.cwd(), "public", "logo", "espi.jpg");
  const logoBytes = fs.readFileSync(logoPath);

  // Fonts
  let poppinsRegularBytes: Buffer | null = null;
  let poppinsBoldBytes: Buffer | null = null;
  try {
    poppinsRegularBytes = fs.readFileSync(path.join(process.cwd(), "public", "fonts", "Poppins-Regular.ttf"));
    poppinsBoldBytes = fs.readFileSync(path.join(process.cwd(), "public", "fonts", "Poppins-Bold.ttf"));
  } catch {
    console.warn("⚠️ Polices Poppins non trouvées, utilisation des polices standard");
  }

  // Signatures
  const signatureCache = new Map<string, Buffer>();
  for (const [code, filename] of Object.entries(SIGNATURE_MAP)) {
    const sigPath = path.join(process.cwd(), "public", "signatures", filename);
    if (fs.existsSync(sigPath)) {
      signatureCache.set(code, fs.readFileSync(sigPath));
      signatureCache.set(filename, fs.readFileSync(sigPath)); // aussi par nom de fichier
    }
  }

  return { logoBytes, poppinsRegularBytes, poppinsBoldBytes, signatureCache };
}

// ============================================================
// UTILITAIRES
// ============================================================

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

const isUEByName = (x: { NOM_MATIERE?: string | null }) => {
  const n = String(x.NOM_MATIERE ?? "").trim().toUpperCase();
  return n.startsWith("UE") || n === "INTERNATIONAL";
};

const norm = (x: any) => String(x ?? "").trim().toUpperCase();
const toOrder = (v?: string | number | null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 999;
};

function getSignatureFilename(codePersonnel: string): string | null {
  return SIGNATURE_MAP[codePersonnel] || null;
}

function isTPGroup(groupInfo: GroupInfo[]): boolean {
  return groupInfo.length > 0 && !!groupInfo[0].NOM_GROUPE?.includes("none");
}

function isUE4RelatedSubject(subject: any, ueMap: Map<string, { ue: any; matieres: any[] }>): boolean {
  if (subject.NOM_MATIERE && subject.NOM_MATIERE.includes("UE 4")) return true;
  for (const [, { ue, matieres }] of ueMap) {
    if (ue.NOM_MATIERE && ue.NOM_MATIERE.includes("UE 4")) {
      if (matieres.some((m) => m.CODE_MATIERE === subject.CODE_MATIERE)) return true;
    }
  }
  return false;
}

// ============================================================
// TRAITEMENT DES ABSENCES
// ============================================================

function processAbsences(
  absences: Absence[],
  startDate = "2025-08-25 00:00:00",
  endDate = "2026-08-23 00:00:00",
  handleDuplicates: "sum" | "max" | "deduplicate" = "sum"
): {
  students: ProcessedAbsence[];
  globalTotals: { justifiees: number; injustifiees: number; retards: number; justifieesFormatted: string; injustifieesFormatted: string; retardsFormatted: string; };
  duplicatesInfo: { duplicateGroups: any[]; totalDuplicates: number; };
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
        if (absenceDate < filterStartDate || absenceDate > filterEndDate) return;
      } catch { return; }
    }
    const duree = parseInt(DUREE?.toString() || "0", 10);
    if (duree <= 0) return;
    if (!duplicateGroups[CODE_ABSENCE]) duplicateGroups[CODE_ABSENCE] = [];
    duplicateGroups[CODE_ABSENCE].push({ ...absence, originalIndex: index, duree });
  });

  const duplicateStats: DuplicateStat[] = [];
  let totalDuplicatesFound = 0;

  Object.keys(duplicateGroups).forEach((codeAbsence) => {
    const group = duplicateGroups[codeAbsence];
    if (group.length > 1) {
      totalDuplicatesFound++;
      duplicateStats.push({
        codeAbsence,
        count: group.length,
        durees: group.map((item) => item.duree),
        totalDuree: group.reduce((sum, item) => sum + item.duree, 0),
        maxDuree: Math.max(...group.map((item) => item.duree)),
        dates: group[0].DATE_DEB + " → " + group[0].DATE_FIN,
      });
    }
  });

  let totalJustifiees = 0;
  let totalInjustifiees = 0;
  let totalRetards = 0;

  Object.values(duplicateGroups).forEach((group) => {
    const representative = group[0];
    const { CODE_APPRENANT, NOM_APPRENANT, PRENOM_APPRENANT, IS_JUSTIFIE, IS_RETARD, DATE_DEB, DATE_FIN } = representative;

    if (!groupedAbsences[CODE_APPRENANT]) {
      groupedAbsences[CODE_APPRENANT] = {
        CODE_APPRENANT, NOM_APPRENANT, PRENOM_APPRENANT,
        ABSENCES_JUSTIFIEES: "00h00", ABSENCES_INJUSTIFIEES: "00h00", RETARDS: "00h00",
      };
    }

    const hasMultipleEntries = group.length > 1;
    const uniqueDurations = new Set(group.map((item) => item.duree)).size;
    const sameDates = group.every((item) => item.DATE_DEB === DATE_DEB && item.DATE_FIN === DATE_FIN);
    const isSplitOverMultipleLines = hasMultipleEntries && sameDates && uniqueDurations >= 1;

    let dureeToUse = 0;
    if (isSplitOverMultipleLines) {
      dureeToUse = group.reduce((sum, item) => sum + item.duree, 0);
    } else {
      switch (handleDuplicates) {
        case "sum": dureeToUse = group.reduce((sum, item) => sum + item.duree, 0); break;
        case "max": dureeToUse = Math.max(...group.map((item) => item.duree)); break;
        case "deduplicate": dureeToUse = group[0].duree; break;
      }
    }

    const student = groupedAbsences[CODE_APPRENANT];
    const isJustifie = IS_JUSTIFIE === 1 || IS_JUSTIFIE === "1";
    const isRetard = IS_RETARD === 1 || IS_RETARD === "1";
    const isInjustifie = (IS_JUSTIFIE === 0 || IS_JUSTIFIE === "0") && (IS_RETARD === 0 || IS_RETARD === "0");

    if (isRetard) {
      student.RETARDS = formatTime(parseTimeToMinutes(student.RETARDS) + dureeToUse);
      totalRetards += dureeToUse;
    } else if (isJustifie) {
      student.ABSENCES_JUSTIFIEES = formatTime(parseTimeToMinutes(student.ABSENCES_JUSTIFIEES) + dureeToUse);
      totalJustifiees += dureeToUse;
    } else if (isInjustifie) {
      student.ABSENCES_INJUSTIFIEES = formatTime(parseTimeToMinutes(student.ABSENCES_INJUSTIFIEES) + dureeToUse);
      totalInjustifiees += dureeToUse;
    }
  });

  return {
    students: Object.values(groupedAbsences),
    globalTotals: {
      justifiees: totalJustifiees, injustifiees: totalInjustifiees, retards: totalRetards,
      justifieesFormatted: formatTime(totalJustifiees),
      injustifieesFormatted: formatTime(totalInjustifiees),
      retardsFormatted: formatTime(totalRetards),
    },
    duplicatesInfo: { duplicateGroups: duplicateStats, totalDuplicates: totalDuplicatesFound },
  };
}

// ============================================================
// MISE À JOUR DES CRÉDITS UE
// ============================================================

function updateUECredits(subjects: any[]): any[] {
  const result = subjects.map((subject) => ({ ...subject }));
  const uniqueSubjectsMap = new Map<string, any>();

  result.forEach((subject) => {
    const key = `${subject.CODE_APPRENANT}_${subject.CODE_MATIERE}`;
    if (subject.CREDIT_ECTS !== undefined) subject.CREDIT_ECTS = Number(subject.CREDIT_ECTS) || 0;
    if (!uniqueSubjectsMap.has(key)) uniqueSubjectsMap.set(key, { ...subject });
  });

  const studentSubjects = new Map<string, any[]>();
  [...uniqueSubjectsMap.values()].forEach((subject) => {
    const studentId = subject.CODE_APPRENANT;
    if (!studentSubjects.has(studentId)) studentSubjects.set(studentId, []);
    studentSubjects.get(studentId)?.push({ ...subject });
  });

  const finalResult: any[] = [];
  studentSubjects.forEach((studentSubjectList) => {
    const sortedSubjects = studentSubjectList.sort((a, b) => {
      return parseInt(a.NUM_ORDRE || "0", 10) - parseInt(b.NUM_ORDRE || "0", 10);
    });
    finalResult.push(...sortedSubjects);
  });

  return finalResult;
}

// ============================================================
// ASSOCIATION MATIÈRES AUX UE
// ============================================================

function associerMatieresAuxUE(
  grades: StudentGrade[],
  subjects: SubjectECTS[] = []
): Map<string, { ue: StudentGrade; matieres: StudentGrade[] }> {
  const ueMap = new Map<string, { ue: StudentGrade; matieres: StudentGrade[] }>();

  for (const g of grades) {
    if (isUEByName(g)) ueMap.set(norm(g.CODE_MATIERE), { ue: g, matieres: [] });
  }
  for (const s of subjects) {
    if (isUEByName(s) && !ueMap.has(norm(s.CODE_MATIERE))) {
      ueMap.set(norm(s.CODE_MATIERE), { ue: s as unknown as StudentGrade, matieres: [] });
    }
  }

  const uesList = Array.from(ueMap.values()).map((x) => x.ue);

  const attach = (item: any) => {
    if (isUEByName(item)) return;

    const parent = norm(item.CODE_UE_PARENT);
    if (parent && ueMap.has(parent)) {
      ueMap.get(parent)!.matieres.push(item);
      return;
    }

    if (isUE4RelatedSubject(item, ueMap as any)) {
      for (const [code, { ue }] of ueMap) {
        if (norm((ue as any).NOM_MATIERE).includes("UE 4")) {
          ueMap.get(code)!.matieres.push(item);
          return;
        }
      }
    }

    for (const [code, { ue }] of ueMap) {
      const ueName = norm((ue as any).NOM_MATIERE);
      const itemName = norm(item.NOM_MATIERE);
      if (ueName === "INTERNATIONAL" && /INTERNATION/.test(itemName)) {
        ueMap.get(code)!.matieres.push(item);
        return;
      }
    }

    const ord = toOrder(item.NUM_ORDRE);
    let best: any = null, bestDiff = Infinity;
    for (const ue of uesList) {
      const diff = ord - toOrder((ue as any).NUM_ORDRE ?? 0);
      if (diff > 0 && diff < bestDiff) { bestDiff = diff; best = ue; }
    }
    if (best) ueMap.get(norm((best as any).CODE_MATIERE))!.matieres.push(item);
  };

  for (const g of grades) if (!isUEByName(g)) attach(g);
  const knownGradeCodes = new Set(grades.map((g) => norm(g.CODE_MATIERE)));
  for (const s of subjects) {
    if (!isUEByName(s) && !knownGradeCodes.has(norm(s.CODE_MATIERE))) attach(s);
  }

  return ueMap;
}

// ============================================================
// EN-TÊTE DU TABLEAU
// ============================================================

function drawTableHeader(
  page: any, currentY: number,
  col1X: number, col2X: number, col3X: number, col4X: number,
  col1Width: number, col2Width: number, col3Width: number, col4Width: number,
  tableWidth: number, rowHeight: number, fontSize: number,
  boldFont: any, espiGray: any, espiBlue: any, rgb: any
): number {
  page.drawRectangle({ x: col1X, y: currentY - rowHeight, width: tableWidth, height: rowHeight, borderColor: espiGray, borderWidth: 1, color: espiBlue });
  page.drawLine({ start: { x: col2X, y: currentY }, end: { x: col2X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
  page.drawLine({ start: { x: col3X, y: currentY }, end: { x: col3X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
  page.drawLine({ start: { x: col4X, y: currentY }, end: { x: col4X, y: currentY - rowHeight }, thickness: 1, color: espiGray });

  const texts = [
    { text: "Enseignements", x: col1X, width: col1Width },
    { text: "Moyenne", x: col2X, width: col2Width },
    { text: "Total ECTS", x: col3X, width: col3Width },
    { text: "État", x: col4X, width: col4Width },
  ];

  for (const { text, x, width } of texts) {
    const tw = boldFont.widthOfTextAtSize(text, fontSize);
    page.drawText(text, { x: x + width / 2 - tw / 2, y: currentY - 15, size: fontSize, font: boldFont, color: rgb(1, 1, 1) });
  }

  return currentY - rowHeight;
}

// ============================================================
// SAUT DE PAGE GROUPES TP
// ============================================================

function handleTPPageBreak(
  isTPGroupFlag: boolean, currentSubject: any, ue4MatiereCounter: number,
  shouldBreakForUE4: boolean, currentY: number, pdfDoc: any,
  pageHeight: number, margin: number,
  col1X: number, col2X: number, col3X: number, col4X: number,
  col1Width: number, col2Width: number, col3Width: number, col4Width: number,
  tableWidth: number, rowHeight: number, fontSize: number,
  boldFont: any, espiGray: any, espiBlue: any, rgb: any
): { shouldBreak: boolean; newPage?: any; newCurrentY?: number } {
  const needsPageBreak = isTPGroupFlag && (shouldBreakForUE4 || currentY < margin + 3 * rowHeight);

  if (needsPageBreak) {
    const newPage = pdfDoc.addPage([595.28, 841.89]);
    let newCurrentY = pageHeight - margin;
    newCurrentY = drawTableHeader(newPage, newCurrentY, col1X, col2X, col3X, col4X, col1Width, col2Width, col3Width, col4Width, tableWidth, rowHeight, fontSize, boldFont, espiGray, espiBlue, rgb);
    return { shouldBreak: true, newPage, newCurrentY };
  }
  return { shouldBreak: false };
}

// ============================================================
// CRÉATION DU PDF PAR ÉTUDIANT
// ============================================================

async function createStudentPDF(
  student: StudentData,
  grades: StudentGrade[],
  ueAverages: any[],
  observations: Observation[],
  subjects: SubjectECTS[],
  groupInfo: GroupInfo[],
  campusInfo: CampusInfo[],
  period: string,
  absence: Absence[],
  processedABS: ProcessedAbsence[],
  assets: PreloadedAssets,        // ✅ Assets préchargés passés en paramètre
  personnelData?: any[],
  notes?: any[],
  generalAverages?: StudentAverage[]
): Promise<Uint8Array> {
  try {
    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([595.28, 841.89]);

    // ✅ Utiliser les assets préchargés au lieu de les lire depuis le disque
    let poppinsRegular, poppinsBold;
    if (assets.poppinsRegularBytes && assets.poppinsBoldBytes) {
      pdfDoc.registerFontkit(fontkit);
      poppinsRegular = await pdfDoc.embedFont(assets.poppinsRegularBytes);
      poppinsBold = await pdfDoc.embedFont(assets.poppinsBoldBytes);
    }

    const mainFont = poppinsRegular || (await pdfDoc.embedFont(StandardFonts.Helvetica));
    const boldFont = poppinsBold || (await pdfDoc.embedFont(StandardFonts.HelveticaBold));

    const fontSize = 8;
    const fontSizeBold = 8;
    const fontSizeTitle = 11;
    const margin = 44;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();
    let currentY = pageHeight - margin;

    const espiBlue = rgb(0.04, 0.36, 0.51);
    const espiGray = rgb(0.925, 0.925, 0.925);

    // Filtrage des données propres à cet étudiant
    const studentGrades = grades.filter((g) => g.CODE_APPRENANT === student.CODE_APPRENANT);
    const studentSubjects = subjects.filter((s) => s.CODE_APPRENANT === student.CODE_APPRENANT);

    const matiereEtats = new Map<string, string>();
    const ueEtats = new Map<string, Etat>();
    const ueMap = associerMatieresAuxUE(studentGrades, studentSubjects);

    // Calcul des états des matières
    for (const { matieres } of ueMap.values()) {
      for (const m of matieres) {
        let finalEtat: string = "NV";
        const gradeInfo = grades.find(g => g.CODE_APPRENANT === student.CODE_APPRENANT && g.CODE_MATIERE === m.CODE_MATIERE);
        const noteInfo = notes?.find(n => n.CODE_APPRENANT === student.CODE_APPRENANT && n.CODE_MATIERE === m.CODE_MATIERE);
        const evalText = gradeInfo?.NOM_EVALUATION_NOTE || "";
        const moyenneRaw = gradeInfo?.MOYENNE;

        if (evalText === "Validé" || String(moyenneRaw).toUpperCase() === "VA") {
          finalEtat = "VA";
        } else if (moyenneRaw !== null && moyenneRaw !== undefined && !isNaN(parseFloat(String(moyenneRaw).replace(",", ".")))) {
          const n = parseFloat(String(moyenneRaw).replace(",", "."));
          finalEtat = n >= 10 ? "VA" : n >= 8 ? "TEMP_8_10" : "NV";
        } else if (noteInfo && Number(noteInfo.CODE_EVALUATION_NOTE) === 1) {
          finalEtat = "VA";
        }
        matiereEtats.set(m.CODE_MATIERE, finalEtat);
      }
    }

    // Logique de compensation
    for (const [, { matieres }] of ueMap) {
      const etatsUe = matieres.map(m => matiereEtats.get(m.CODE_MATIERE));
      const hasNV = etatsUe.includes("NV");
      const hasVA = etatsUe.includes("VA");
      for (const m of matieres) {
        if (matiereEtats.get(m.CODE_MATIERE) === "TEMP_8_10") {
          matiereEtats.set(m.CODE_MATIERE, (!hasNV && hasVA) ? "C" : "NV");
        }
      }
    }

    // État final de chaque UE
    for (const [ueCode, { ue, matieres }] of ueMap) {
      const etatsFinaux = matieres.map(m => normalizeEtat(matiereEtats.get(m.CODE_MATIERE)));
      const avgFromRow = parseUeAverage((ue as any)?.MOYENNE_UE ?? (ue as any)?.MOYENNE);
      const ueAvg = avgFromRow ?? getUeAverage(ueAverages, ueCode, student.CODE_APPRENANT);
      const finalUEStatus = getEtatUE(etatsFinaux, ueAvg);
      ueEtats.set(ueCode, finalUEStatus);
    }

    // Sync ECTS matières NV
    for (const subject of studentSubjects) {
      if (matiereEtats.get(subject.CODE_MATIERE) === "NV" && !isUEByName(subject)) {
        subject.CREDIT_ECTS = 0;
      }
    }

    // ✅ Logo depuis assets préchargés
    const logoOffsetLeft = 20;
    currentY = pageHeight - margin / 2;
    try {
      const logoImage = await pdfDoc.embedJpg(assets.logoBytes);
      const logoDims = logoImage.scale(0.25);
      page.drawImage(logoImage, { x: margin - logoOffsetLeft, y: currentY - logoDims.height, width: logoDims.width, height: logoDims.height });
      currentY -= logoDims.height;
    } catch {
      page.drawText("ESPI", { x: margin - logoOffsetLeft, y: currentY, size: 24, font: mainFont, color: rgb(0.2, 0.6, 0.6) });
    }

    // Identifiant étudiant (invisible - taille 4)
    currentY -= 10;
    page.drawText(`Identifiant : ${student.CODE_APPRENANT}`, { x: pageWidth - margin - 150, y: currentY, size: 4, font: mainFont, color: rgb(1, 1, 1) });

    // Titre
    currentY -= 10;
    const bulletinTitle = "Bulletin de notes 2025-2026";
    const bulletinTitleWidth = boldFont.widthOfTextAtSize(bulletinTitle, fontSizeTitle);
    page.drawText(bulletinTitle, { x: (pageWidth - bulletinTitleWidth) / 2, y: currentY, size: fontSizeTitle, font: boldFont, color: espiBlue });

    const group = groupInfo.length > 0 ? groupInfo[0] : null;
    const etenduGroupe = group?.ETENDU_GROUPE || "";
    const keyword = "spécialité";
    const indexSpecialite = etenduGroupe.indexOf(keyword);

    if (indexSpecialite !== -1) {
      const line1 = etenduGroupe.substring(0, indexSpecialite + keyword.length);
      const line2 = etenduGroupe.substring(indexSpecialite + keyword.length).trim() + " " + period;
      currentY -= 20;
      page.drawText(line1, { x: (pageWidth - boldFont.widthOfTextAtSize(line1, fontSizeTitle)) / 2, y: currentY, size: fontSizeTitle, font: boldFont, color: espiBlue });
      currentY -= 15;
      page.drawText(line2, { x: (pageWidth - boldFont.widthOfTextAtSize(line2, fontSizeTitle)) / 2, y: currentY, size: fontSizeTitle, font: boldFont, color: espiBlue });
    } else {
      currentY -= 20;
      const periodeText = `${etenduGroupe} ${period}`;
      page.drawText(periodeText, { x: (pageWidth - boldFont.widthOfTextAtSize(periodeText, fontSizeTitle)) / 2, y: currentY, size: fontSizeTitle, font: boldFont, color: espiBlue });
    }

    currentY -= 20;

    // Cadre infos étudiant/groupe
    const boxWidth = pageWidth - 2 * margin;
    const boxHeight = 40;
    page.drawRectangle({ x: margin, y: currentY - boxHeight, width: boxWidth, height: boxHeight, borderColor: espiBlue, borderWidth: 1 });
    page.drawLine({ start: { x: margin + boxWidth / 2, y: currentY }, end: { x: margin + boxWidth / 2, y: currentY - boxHeight }, thickness: 1, color: espiBlue });

    page.drawText(`Apprenant : ${student.NOM_APPRENANT} ${student.PRENOM_APPRENANT}`, { x: margin + 5, y: currentY - 15, size: fontSizeBold, font: mainFont, color: espiBlue });
    if (student.DATE_NAISSANCE) {
      page.drawText(`Date de naissance : ${new Date(student.DATE_NAISSANCE).toLocaleDateString("fr-FR")}`, { x: margin + 5, y: currentY - 30, size: fontSize, font: mainFont, color: espiBlue });
    }

    const campus = campusInfo.length > 0 ? campusInfo[0] : null;
    page.drawText(`Groupe : ${group ? group.NOM_GROUPE : "Non spécifié"}`, { x: margin + boxWidth / 2 + 5, y: currentY - 15, size: fontSize, font: mainFont, color: espiBlue });
    page.drawText(`Campus : ${campus ? campus.NOM_SITE : "Non spécifié"}`, { x: margin + boxWidth / 2 + 5, y: currentY - 30, size: fontSize, font: mainFont, color: espiBlue });

    currentY -= boxHeight + 10;

    // Tableau des notes
    const rowHeight = 16;
    const tableWidth = boxWidth;
    const tableLeftMargin = margin + (boxWidth - tableWidth) / 2;
    const col1Width = tableWidth * 0.55;
    const col2Width = tableWidth * 0.15;
    const col3Width = tableWidth * 0.15;
    const col4Width = tableWidth * 0.15;
    const col1X = tableLeftMargin;
    const col2X = col1X + col1Width;
    const col3X = col2X + col2Width;
    const col4X = col3X + col3Width;

    // En-tête tableau
    page.drawRectangle({ x: col1X, y: currentY - rowHeight, width: tableWidth, height: rowHeight, borderColor: espiGray, borderWidth: 1, color: espiBlue });
    page.drawLine({ start: { x: col2X, y: currentY }, end: { x: col2X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
    page.drawLine({ start: { x: col3X, y: currentY }, end: { x: col3X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
    page.drawLine({ start: { x: col4X, y: currentY }, end: { x: col4X, y: currentY - rowHeight }, thickness: 1, color: espiGray });

    for (const { text, x, w } of [
      { text: "Enseignements", x: col1X, w: col1Width },
      { text: "Moyenne", x: col2X, w: col2Width },
      { text: "Total ECTS", x: col3X, w: col3Width },
      { text: "État", x: col4X, w: col4Width },
    ]) {
      const tw = boldFont.widthOfTextAtSize(text, fontSize);
      page.drawText(text, { x: x + w / 2 - tw / 2, y: currentY - 10, size: fontSize, font: boldFont, color: rgb(1, 1, 1) });
    }

    currentY -= rowHeight;

    // Construction des matières à afficher
    const allSubjects = subjects
      .filter((s) => s.CODE_APPRENANT === student.CODE_APPRENANT)
      .map((subject) => {
        const note = grades.find((g) => g.CODE_APPRENANT === student.CODE_APPRENANT && g.CODE_MATIERE === subject.CODE_MATIERE);
        return {
          CODE_MATIERE: subject.CODE_MATIERE,
          NOM_MATIERE: subject.NOM_MATIERE,
          MOYENNE: note ? note.MOYENNE : undefined,
          NOM_EVALUATION_NOTE: note?.NOM_EVALUATION_NOTE || "",
          CREDIT_ECTS: subject.CREDIT_ECTS || 0,
          NUM_ORDRE: String(subject.NUM_ORDRE || "999"),
        };
      })
      .sort((a, b) => parseInt(a.NUM_ORDRE, 10) - parseInt(b.NUM_ORDRE, 10));

    // Mise à 0 des ECTS matières sans note
    for (const subject of allSubjects) {
      if (!isUEByName(subject) && subject.MOYENNE === undefined && !matiereEtats.has(subject.CODE_MATIERE)) {
        subject.CREDIT_ECTS = 0;
      }
    }

    // Dictionnaire matière → UE
    const matiereToUeMap = new Map<string, string>();
    for (const [ueCode, { matieres }] of ueMap) {
      for (const matiere of matieres) matiereToUeMap.set(matiere.CODE_MATIERE, ueCode);
    }

    // Mise à 0 ECTS NV
    for (const subject of studentSubjects) {
      if (matiereEtats.get(subject.CODE_MATIERE) === "NV" && !isUEByName(subject)) subject.CREDIT_ECTS = 0;
    }

    // Calcul totaux ECTS par UE
    const ueEctsMap = new Map<string, number>();
    for (const [ueCode] of ueMap) ueEctsMap.set(ueCode, 0);

    for (const subject of studentSubjects) {
      if (!isUEByName(subject)) {
        const ueCode = matiereToUeMap.get(subject.CODE_MATIERE);
        const etat = matiereEtats.get(subject.CODE_MATIERE);
        if (ueCode && (etat === "VA" || etat === "C")) {
          ueEctsMap.set(ueCode, (ueEctsMap.get(ueCode) || 0) + (Number(subject.CREDIT_ECTS) || 0));
        }
      }
    }

    // Mise à jour ECTS des UEs dans allSubjects
    for (const subject of allSubjects) {
      if (isUEByName(subject)) {
        for (const [ueCode] of ueMap) {
          if (subject.CODE_MATIERE === ueCode) {
            subject.CREDIT_ECTS = ueEctsMap.get(ueCode) || 0;
            break;
          }
        }
      }
    }

    // Boucle d'affichage des matières
    const isTPGroupFlag = isTPGroup(groupInfo);
    let ue4MatiereCounter = 0;
    let hasAlreadyBrokenPage = false;

    for (const subject of allSubjects) {
      const isUE = isUEByName(subject);

      if (isUE4RelatedSubject(subject, ueMap as any)) ue4MatiereCounter++;

      const shouldBreakForUE4 = isTPGroupFlag && isUE4RelatedSubject(subject, ueMap as any) && ue4MatiereCounter === 4 && !hasAlreadyBrokenPage;

      const pageBreakResult = handleTPPageBreak(isTPGroupFlag, subject, ue4MatiereCounter, shouldBreakForUE4, currentY, pdfDoc, pageHeight, margin, col1X, col2X, col3X, col4X, col1Width, col2Width, col3Width, col4Width, tableWidth, rowHeight, fontSize, boldFont, espiGray, espiBlue, rgb);

      if (pageBreakResult.shouldBreak) {
        page = pageBreakResult.newPage!;
        currentY = pageBreakResult.newCurrentY!;
        hasAlreadyBrokenPage = true;
      }

      const backgroundColor = isUE ? espiGray : undefined;
      page.drawRectangle({ x: col1X, y: currentY - rowHeight, width: tableWidth, height: rowHeight, borderColor: espiGray, borderWidth: 1, color: backgroundColor });
      page.drawLine({ start: { x: col2X, y: currentY }, end: { x: col2X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
      page.drawLine({ start: { x: col3X, y: currentY }, end: { x: col3X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
      page.drawLine({ start: { x: col4X, y: currentY }, end: { x: col4X, y: currentY - rowHeight }, thickness: 1, color: espiGray });

      page.drawText(subject.NOM_MATIERE, { x: col1X + 5, y: currentY - 10, size: fontSize, font: isUE ? boldFont : mainFont, color: rgb(0, 0, 0) });

      // Moyenne
      let moyenne = "-";
      if (subject.MOYENNE !== undefined && subject.MOYENNE !== null) {
        const moyenneStr = String(subject.MOYENNE);
        if (moyenneStr === "VA" || moyenneStr === "NV") {
          moyenne = moyenneStr;
        } else {
          try { moyenne = parseFloat(moyenneStr.replace(",", ".")).toFixed(2).replace(".", ","); } catch { moyenne = "-"; }
        }
      } else {
        if (subject.NOM_EVALUATION_NOTE === "Validé") { moyenne = "Validé"; matiereEtats.set(subject.CODE_MATIERE, "VA"); }
        else if (subject.NOM_EVALUATION_NOTE === "Non Validé") { moyenne = "Non Validé"; matiereEtats.set(subject.CODE_MATIERE, "NV"); }
        else { moyenne = "-"; if (!matiereEtats.has(subject.CODE_MATIERE)) matiereEtats.set(subject.CODE_MATIERE, "NV"); }
      }

      const moyW = mainFont.widthOfTextAtSize(moyenne, fontSize);
      page.drawText(moyenne, { x: col2X + col2Width / 2 - moyW / 2, y: currentY - 10, size: fontSize, font: isUE ? boldFont : mainFont, color: rgb(0, 0, 0) });

      // État
      let etat = "-";
      if (isUEByName(subject)) {
        etat = ueEtats.get(subject.CODE_MATIERE) || "NV";
      } else {
        const etatCalculé = matiereEtats.get(subject.CODE_MATIERE);
        if (etatCalculé !== undefined) {
          etat = etatCalculé;
        } else {
          const moyenneStr = subject.MOYENNE !== undefined && subject.MOYENNE !== null ? String(subject.MOYENNE) : "-";
          if (moyenneStr === "VA") etat = "VA";
          else if (moyenneStr === "NV") etat = "NV";
          else if (moyenneStr === "-") etat = "-";
          else {
            try {
              const v = parseFloat(moyenneStr.replace(",", "."));
              etat = !isNaN(v) ? (v >= 10 ? "VA" : "NV") : "NV";
            } catch { etat = "NV"; }
          }
        }
      }

      if (etat === "NV" && !isUEByName(subject)) subject.CREDIT_ECTS = 0;

      const ects = subject.CREDIT_ECTS.toString();
      const ectsW = mainFont.widthOfTextAtSize(ects, fontSize);
      page.drawText(ects, { x: col3X + col3Width / 2 - ectsW / 2, y: currentY - 10, size: fontSize, font: isUE ? boldFont : mainFont, color: rgb(0, 0, 0) });

      const etatFont = isUE ? boldFont : etat === "C" ? boldFont : mainFont;
      const etatColor = etat === "C" ? rgb(0.04, 0.36, 0.51) : rgb(0, 0, 0);
      const etatW = mainFont.widthOfTextAtSize(etat, fontSize);
      page.drawText(etat, { x: col4X + col4Width / 2 - etatW / 2, y: currentY - 10, size: fontSize, font: etatFont, color: etatColor });

      currentY -= rowHeight;

      if (currentY < margin + rowHeight) {
        page = pdfDoc.addPage([595.28, 841.89]);
        currentY = pageHeight - margin;
      }
    }

    // Ligne moyenne générale
    page.drawRectangle({ x: col1X, y: currentY - rowHeight, width: tableWidth, height: rowHeight, borderColor: espiBlue, borderWidth: 1, color: espiBlue });
    page.drawLine({ start: { x: col2X, y: currentY }, end: { x: col2X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
    page.drawLine({ start: { x: col3X, y: currentY }, end: { x: col3X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
    page.drawLine({ start: { x: col4X, y: currentY }, end: { x: col4X, y: currentY - rowHeight }, thickness: 1, color: espiGray });
    page.drawText("Moyenne générale", { x: col1X + 5, y: currentY - 10, size: fontSize, font: boldFont, color: rgb(1, 1, 1) });

    const studentAverage = generalAverages?.find((avg: any) => avg.CODE_APPRENANT === student.CODE_APPRENANT);
    let moyenneGenerale = "N/A";
    if (studentAverage) {
      try {
        const raw = studentAverage.MOYENNE_GENERALE as any;
        const val = typeof raw === "string" ? parseFloat(raw.replace(",", ".")) : raw;
        if (val !== null && !isNaN(val)) moyenneGenerale = typeof val.toFixed === "function" ? val.toFixed(2).replace(".", ",") : val.toString();
      } catch {}
    }

    const mgW = mainFont.widthOfTextAtSize(moyenneGenerale, fontSize);
    page.drawText(moyenneGenerale, { x: col2X + col2Width / 2 - mgW / 2, y: currentY - 10, size: fontSize, font: boldFont, color: rgb(1, 1, 1) });

    const totalECTS = Array.from(ueEctsMap.values()).reduce((acc, e) => acc + e, 0);
    const totalECTSText = String(Number(totalECTS) || 0);
    const totalECTSW = mainFont.widthOfTextAtSize(totalECTSText, fontSize);
    page.drawText(totalECTSText, { x: col3X + col3Width / 2 - totalECTSW / 2, y: currentY - 10, size: fontSize, font: boldFont, color: rgb(1, 1, 1) });

    const getEtatGeneral = (subjects: SubjectECTS[], studentId: string, ueEtats: Map<string, string>): string => {
      const ueSubjects = subjects.filter((s) => s.CODE_APPRENANT === studentId && isUEByName(s));
      if (ueSubjects.length === 0) return "NV";
      return ueSubjects.every((ue) => ueEtats.get(ue.CODE_MATIERE) === "VA") ? "VA" : "NV";
    };

    const etatGeneral = getEtatGeneral(subjects, student.CODE_APPRENANT, ueEtats);
    const egW = mainFont.widthOfTextAtSize(etatGeneral, fontSize);
    page.drawText(etatGeneral, { x: col4X + col4Width / 2 - egW / 2, y: currentY - 10, size: fontSize, font: boldFont, color: rgb(1, 1, 1) });

    currentY -= rowHeight + 10;

    // Section absences
    const boxWidthABS = pageWidth - 2 * margin;
    const boxHeightABS = 36;
    page.drawRectangle({ x: margin, y: currentY - boxHeightABS, width: boxWidthABS, height: boxHeightABS, borderColor: espiBlue, borderWidth: 1 });
    page.drawLine({ start: { x: margin + boxWidthABS / 3, y: currentY }, end: { x: margin + boxWidthABS / 3, y: currentY - boxHeightABS }, thickness: 1, color: espiBlue });
    page.drawLine({ start: { x: margin + (2 * boxWidthABS) / 3, y: currentY }, end: { x: margin + (2 * boxWidthABS) / 3, y: currentY - boxHeightABS }, thickness: 1, color: espiBlue });

    const studentAbsence = processedABS.find((abs) => abs.CODE_APPRENANT === student.CODE_APPRENANT);
    const colWidth = boxWidthABS / 3;
    const absData = studentAbsence
      ? [studentAbsence.ABSENCES_JUSTIFIEES, studentAbsence.ABSENCES_INJUSTIFIEES, studentAbsence.RETARDS]
      : ["00h00", "00h00", "00h00"];
    const absTitles = ["Absences justifiées", "Absences injustifiées", "Retards"];

    absTitles.forEach((title, i) => {
      const titleW = mainFont.widthOfTextAtSize(title, fontSize);
      const valueW = mainFont.widthOfTextAtSize(absData[i], fontSize);
      const colCenter = margin + i * colWidth + colWidth / 2;
      page.drawText(title, { x: colCenter - titleW / 2, y: currentY - 15, size: fontSize, font: mainFont, color: espiBlue });
      page.drawText(absData[i], { x: colCenter - valueW / 2, y: currentY - 30, size: fontSize, font: mainFont, color: espiBlue });
    });

    currentY -= boxHeightABS + 15;

    // Observations
    const studentObservation = observations.find((obs) => obs.CODE_APPRENANT === student.CODE_APPRENANT);
    if (studentObservation) {
      page.drawText("Appréciations :", { x: col1X, y: currentY, size: fontSize, font: mainFont, color: espiBlue });
      currentY -= 15;

      let observationText = "";
      try {
        observationText = (studentObservation.MEMO_OBSERVATION || "").replace(/\r/g, " ").replace(/[^\x20-\x7E\xA0-\xFF]/g, " ");
      } catch { observationText = "Observations non disponibles."; }

      const maxWidth = pageWidth - 2 * margin;
      const words = observationText.split(" ");
      let line = "";

      for (const word of words) {
        try {
          const testLine = line + (line ? " " : "") + word;
          if (mainFont.widthOfTextAtSize(testLine, fontSize) > maxWidth) {
            page.drawText(line, { x: col1X, y: currentY, size: fontSize, font: mainFont, color: espiBlue });
            line = word;
            currentY -= 12;
            if (currentY < margin) { page = pdfDoc.addPage([595.28, 841.89]); currentY = pageHeight - margin; }
          } else { line = testLine; }
        } catch { continue; }
      }
      if (line) page.drawText(line, { x: col1X, y: currentY, size: fontSize, font: mainFont, color: espiBlue });
    }

    currentY -= 15;

    // Signature
    if (currentY < margin + 60) { page = pdfDoc.addPage([595.28, 841.89]); currentY = pageHeight - margin; }
    const signatureY = currentY - 5;

    page.drawText(`Fait à ${campus ? campus.NOM_SITE : "Paris"}, le ${new Date().toLocaleDateString("fr-FR")}`, { x: pageWidth - margin - 200, y: signatureY, size: 7, font: mainFont });

    let codePersonnel = groupInfo[0]?.CODE_PERSONNEL || "";
    let nomPersonnel = groupInfo[0]?.NOM_PERSONNEL || "";
    let prenomPersonnel = groupInfo[0]?.PRENOM_PERSONNEL || "";
    let nomFonctionPersonnel = groupInfo[0]?.NOM_FONCTION_PERSONNEL || "";

    if ((!nomPersonnel || !prenomPersonnel) && personnelData && personnelData.length > 0) {
      const personnel = personnelData[0];
      codePersonnel = personnel.CODE_PERSONNEL || codePersonnel;
      nomPersonnel = personnel.NOM_PERSONNEL || nomPersonnel;
      prenomPersonnel = personnel.PRENOM_PERSONNEL || prenomPersonnel;
      nomFonctionPersonnel = personnel.NOM_FONCTION_PERSONNEL || nomFonctionPersonnel;
    }

    if (!nomPersonnel) nomPersonnel = "Responsable";
    if (!prenomPersonnel) prenomPersonnel = "Pédagogique";
    if (!nomFonctionPersonnel) nomFonctionPersonnel = "Responsable Pédagogique";
    if (!codePersonnel && campus?.CODE_PERSONNEL) codePersonnel = campus.CODE_PERSONNEL;

    const signatureFilename = getSignatureFilename(codePersonnel);

    // ✅ Signature depuis le cache préchargé
    if (signatureFilename && assets.signatureCache.has(codePersonnel)) {
      try {
        const sigBytes = assets.signatureCache.get(codePersonnel)!;
        const isJpg = signatureFilename.toLowerCase().endsWith(".jpg") || signatureFilename.toLowerCase().endsWith(".jpeg");
        const signatureImage = isJpg ? await pdfDoc.embedJpg(sigBytes) : await pdfDoc.embedPng(sigBytes);

        const personnelCode = groupInfo[0]?.CODE_PERSONNEL || "";
        let scale = 0.2;
        let currentMaxWidth = 120;

        if (String(personnelCode) === "482") { scale = 0.45; currentMaxWidth = 220; }
        else if (String(personnelCode) === "2239") { scale = 0.65; currentMaxWidth = 360; }
        else {
          const ow = signatureImage.width;
          if (ow > 400) scale = 0.15;
          else if (ow < 200) scale = 0.35;
        }

        const scaleByWidth = signatureImage.scale(scale);
        if (scaleByWidth.width > currentMaxWidth) scale = scale * (currentMaxWidth / scaleByWidth.width);
        const signatureDims = signatureImage.scale(scale);

        page.drawText(`Signature du ${nomFonctionPersonnel}`, { x: pageWidth - margin - 200, y: signatureY - 15, size: 7, font: mainFont });
        page.drawText(`${prenomPersonnel} ${nomPersonnel}`, { x: pageWidth - margin - 200, y: signatureY - 27, size: 7, font: boldFont });
        page.drawImage(signatureImage, { x: pageWidth - margin - 200, y: signatureY - 40 - signatureDims.height, width: signatureDims.width, height: signatureDims.height });
      } catch {
        page.drawText(`Signature du : ${nomFonctionPersonnel}`, { x: pageWidth - margin - 200, y: signatureY - 10, size: 7, font: mainFont });
        page.drawText(`${prenomPersonnel} ${nomPersonnel}`, { x: pageWidth - margin - 200, y: signatureY - 22, size: 7, font: boldFont });
      }
    } else {
      page.drawText(`Signature du : ${nomFonctionPersonnel}`, { x: pageWidth - margin - 200, y: signatureY - 10, size: fontSize, font: mainFont });
      page.drawText(`${prenomPersonnel} ${nomPersonnel}`, { x: pageWidth - margin - 200, y: signatureY - 22, size: fontSize, font: boldFont });
    }

    // Légende
    page.drawText("VA : Validé / NV : Non Validé / C : Compensation", { x: margin, y: 25, size: 7, font: mainFont, color: rgb(0.5, 0.5, 0.5) });

    return await pdfDoc.save();
  } catch (error) {
    console.error("Erreur lors de la création du PDF:", error);
    throw error;
  }
}

// ============================================================
// HANDLER POST
// ============================================================

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    if (!body?.data || !body?.periodeEvaluation || !body?.groupName) {
      return NextResponse.json({ error: "Données manquantes pour la génération PDF" }, { status: 400 });
    }

    const { data, periodeEvaluation, groupName } = body;
    console.log(`📥 Requête PDF - Groupe: ${groupName} | Période: ${periodeEvaluation} | Étudiants: ${data.APPRENANT?.length || 0}`);

    // ✅ CORRECTION 1 : Préchargement des assets UNE SEULE FOIS avant la boucle
    const assets = preloadAssets();
    console.log("✅ Assets préchargés (logo, fonts, signatures)");

    // ✅ CORRECTION 2 : updateUECredits calculé UNE SEULE FOIS
    const updatedSubjects = updateUECredits(data.ECTS_PAR_MATIERE || []);
    console.log(`✅ Crédits UE calculés (${updatedSubjects.length} matières)`);

    // ✅ CORRECTION 3 : processAbsences calculé UNE SEULE FOIS
    const processedAbsences = processAbsences(data.ABSENCE || [], "2025-08-25T00:00:00", "2026-08-23T00:00:00").students;
    console.log(`✅ Absences traitées (${processedAbsences.length} étudiants)`);

    // Log UE/Matières
    if (data.MATIERE && data.MATIERE.length > 0) {
      const uniqueSubjects = new Map<string, any>();
      data.MATIERE.forEach((subject: any) => {
        const key = `${subject.CODE_APPRENANT}_${subject.CODE_MATIERE}`;
        if (!uniqueSubjects.has(key)) uniqueSubjects.set(key, subject);
      });
    }

    const zip = new JSZip();
    let successCount = 0;
    let failureCount = 0;

    // Récupérer infos pour le nom de fichier
    let nomFormation = "FORMATION";
    if (data.GROUPE?.[0]?.NOM_FORMATION) {
      nomFormation = data.GROUPE[0].NOM_FORMATION.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    }

    let nomAnnee = "ANNEE";
    const matiereWithAnnee = data.MATIERE?.find((m: any) => m.NOM_ANNEE);
    if (matiereWithAnnee?.NOM_ANNEE) {
      nomAnnee = matiereWithAnnee.NOM_ANNEE.replace(/\s+/g, "_").replace(/[\/\\:*?"<>|]/g, "");
    }

    const periodClean = periodeEvaluation.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");

    // ✅ CORRECTION 4 : Génération parallèle de tous les PDFs
    console.log(`⚡ Génération parallèle de ${data.APPRENANT.length} PDFs...`);

    const pdfResults = await Promise.all(
      data.APPRENANT.map(async (studentObj: any) => {
        const student: StudentData = {
          CODE_APPRENANT: studentObj.CODE_APPRENANT || "",
          NOM_APPRENANT: studentObj.NOM_APPRENANT || "",
          PRENOM_APPRENANT: studentObj.PRENOM_APPRENANT || "",
          DATE_NAISSANCE: studentObj.DATE_NAISSANCE || null,
        };

        try {
          const pdfBytes = await createStudentPDF(
            student,
            data.MOYENNES_UE || [],
            data.MOYENNES_UE || [],
            data.OBSERVATIONS || [],
            updatedSubjects,          // ✅ Réutilisé, pas recalculé
            data.GROUPE || [],
            data.SITE || [],
            periodeEvaluation,
            data.ABSENCE || [],
            processedAbsences,        // ✅ Réutilisé, pas recalculé
            assets,                   // ✅ Assets préchargés partagés
            data.PERSONNEL || [],
            data.NOTES || [],
            data.MOYENNE_GENERALE || []
          );

          const filename = `2025-2026_${nomFormation}_${nomAnnee}_${periodClean}_${student.NOM_APPRENANT}_${student.PRENOM_APPRENANT}.pdf`;
          return { success: true, pdfBytes, filename, student };
        } catch (error) {
          console.error(`❌ Erreur PDF pour ${student.NOM_APPRENANT}:`, error);
          return { success: false, pdfBytes: null, filename: "", student };
        }
      })
    );

    // Ajout des PDFs au ZIP
    for (const result of pdfResults) {
      if (result.success && result.pdfBytes) {
        zip.file(result.filename, result.pdfBytes);
        successCount++;
        console.log(`📄 PDF ajouté: ${result.filename}`);
      } else {
        failureCount++;
      }
    }

    console.log(`✅ ${successCount} PDFs générés, ${failureCount} échecs`);

    if (successCount === 0) {
      return NextResponse.json({ success: false, error: "Aucun PDF n'a pu être généré", details: `${failureCount} bulletins ont échoué` }, { status: 500 });
    }

    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    let groupNameForFilename = data.GROUPE?.[0]?.NOM_GROUPE || groupName;
    let periodNameForFilename = data.MOYENNES_UE?.[0]?.NOM_PERIODE_EVALUATION || periodeEvaluation;

    const sanitizedGroupName = groupNameForFilename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    const sanitizedPeriod = periodNameForFilename.replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_-]/g, "");
    const zipId = `bulletins_${sanitizedGroupName}_${sanitizedPeriod}.zip`;

    fileStorage.storeFile(zipId, Buffer.from(zipBuffer), "application/zip");

    if (!fileStorage.hasFile(zipId)) {
      return NextResponse.json({ success: false, error: "Erreur lors du stockage du fichier ZIP" }, { status: 500 });
    }

    return NextResponse.json({
      path: `/api/download?id=${zipId}`,
      studentCount: data.APPRENANT?.length || 0,
    });

  } catch (error: any) {
    console.error("❌ Erreur génération PDF :", error);
    return NextResponse.json({ error: error.message || "Erreur inattendue lors de la génération des bulletins" }, { status: 500 });
  }
}