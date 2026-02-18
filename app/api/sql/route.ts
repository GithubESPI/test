/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";

interface FormattedData {
  timestamp: string;
  campus: string;
  group: string;
  semester: string;
  queries: {
    [key: string]: {
      results: any[];
      error?: string;
    };
  };
}

interface QueryResults {
  GROUPE: any[];
  SITE: any[];
  APPRENANT: any[];
  ABSENCE: any[];
  MATIERE: any[];
  MOYENNES_UE: any[];
  MOYENNE_GENERALE: any[];
  ECTS_PAR_MATIERE: any[];
  OBSERVATIONS: any[];
  PERSONNEL: any[];
  NOTES: any[];
}

async function executeQuery(query: string, token: string): Promise<any[]> {
  try {
    const url = process.env.URL_REQUETEUR!;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ sql: query }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status} - ${responseText}`);
    }

    try {
      const data = JSON.parse(responseText);
      return Array.isArray(data) ? data : Object.values(data);
    } catch (parseError) {
      throw new Error(`Erreur de parsing JSON: ${responseText}`);
    }
  } catch (error: unknown) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Délai d'attente dépassé pour la requête SQL");
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const campus = body.campus;
    const group = body.group;
    const periodeEvaluationCode = body.periodeEvaluationCode;
    const periodeEvaluation = body.periodeEvaluation;
    const semester = body.semester?.toString() || "s1";

    if (!campus || !group || !periodeEvaluation) {
      return NextResponse.json(
        {
          error: "Paramètres manquants",
          details: "Le campus et le groupe sont requis",
        },
        { status: 400 }
      );
    }

    const token = process.env.TOKEN_REQUETEUR!;

    // Étape 1️⃣ : Récupérer les infos du groupe
    const groupResults = await executeQuery(
      `SELECT NOM_GROUPE, NUMERO_ANNEE, CODE_FORMATION FROM GROUPE WHERE CODE_GROUPE = ${group}`,
      token
    );

    if (!groupResults.length) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucun groupe trouvé",
          details: "Le CODE_GROUPE fourni ne correspond à aucun NOM_GROUPE.",
        },
        { status: 404 }
      );
    }

    const nomGroupe = groupResults[0].NOM_GROUPE;
    const groupNumQuery = groupResults[0].NUMERO_ANNEE;
    const codeFormation = groupResults[0].CODE_FORMATION;

    let codeAnnee = groupNumQuery;
    if (groupNumQuery === 3) {
      codeAnnee = 4;
    }

    // Étape 2️⃣ : Récupérer le CODE_PERIODE_EVALUATION si non fourni
    let cdeval = periodeEvaluationCode;
    if (!cdeval) {
      const codeEvalResults = await executeQuery(
        `SELECT DISTINCT r.CODE_PERIODE_EVALUATION FROM REFERENTIEL r WHERE r.CODE_FORMATION = ${codeFormation} AND r.CODE_SESSION = 5 AND r.CODE_ANNEE = ${codeAnnee}`,
        token
      );
      if (codeEvalResults.length) {
        cdeval = codeEvalResults[0].CODE_PERIODE_EVALUATION;
      }
    }

    // Étape 3️⃣ : Définir toutes les requêtes
    const queries: Record<keyof QueryResults, string> = {
      GROUPE: `
        SELECT DISTINCT g.NOM_GROUPE, g.ETENDU_GROUPE, f.NOM_FORMATION 
        FROM FORMATION f 
        INNER JOIN GROUPE g ON f.CODE_FORMATION = g.CODE_FORMATION 
        INNER JOIN FREQUENTE fr ON g.CODE_GROUPE = fr.CODE_GROUPE 
        INNER JOIN CALENDRIER c ON fr.CODE_CALENDRIER = c.CODE_CALENDRIER 
        INNER JOIN SESSION s ON c.CODE_SESSION = s.CODE_SESSION 
        WHERE g.CODE_GROUPE = ${group} 
        GROUP BY g.NOM_GROUPE, g.ETENDU_GROUPE, f.NOM_FORMATION, s.CODE_SESSION
      `,
      SITE: `
        SELECT DISTINCT s.CODE_SITE, s.NOM_SITE, s.ETENDU_SITE, p.CODE_PERSONNEL 
        FROM SITE s 
        INNER JOIN PERSONNEL p ON s.CODE_PERSONNEL = p.CODE_PERSONNEL
        WHERE s.CODE_SITE = ${campus}
      `,
      APPRENANT: `
        SELECT DISTINCT a.CODE_APPRENANT, a.NOM_APPRENANT, a.PRENOM_APPRENANT, a.DATE_NAISSANCE, 
          g.CODE_GROUPE, c.CODE_CALENDRIER, s.CODE_SESSION, 
          MAX(t.DATE_CLOTURE_INSCRIPTION) as DATE_CLOTURE_INSCRIPTION 
        FROM APPRENANT a 
        INNER JOIN INSCRIPTION i ON a.CODE_APPRENANT = i.CODE_APPRENANT 
        INNER JOIN FREQUENTE f ON i.CODE_INSCRIPTION = f.CODE_INSCRIPTION 
        INNER JOIN GROUPE g ON f.CODE_GROUPE = g.CODE_GROUPE 
        JOIN CALENDRIER c ON f.CODE_CALENDRIER = c.CODE_CALENDRIER 
        INNER JOIN SESSION s ON c.CODE_SESSION = s.CODE_SESSION 
        LEFT JOIN TEMP_TDB_ASSIDUITE_CAL_APPR t ON a.CODE_APPRENANT = t.CODE_APPRENANT 
        WHERE g.CODE_GROUPE = ${group}
        GROUP BY a.CODE_APPRENANT, a.NOM_APPRENANT, a.PRENOM_APPRENANT, a.DATE_NAISSANCE, 
          g.CODE_GROUPE, c.CODE_CALENDRIER, s.CODE_SESSION 
        ORDER BY a.NOM_APPRENANT
      `,
      ABSENCE: `
        SELECT DISTINCT a.CODE_APPRENANT, a.NOM_APPRENANT, a.PRENOM_APPRENANT, g.CODE_GROUPE, 
          abs.CODE_ABSENCE, abs.MINUTE_DEB, abs.MINUTE_FIN, abs.IS_RETARD, ma.IS_JUSTIFIE, 
          ad.DUREE, ad.NUM_JOUR, ad.DATE_ABSENCE, s.CODE_SESSION, s.DATE_DEB, s.DATE_FIN 
        FROM GROUPE g 
        INNER JOIN FREQUENTE f ON g.CODE_GROUPE = f.CODE_GROUPE 
        INNER JOIN INSCRIPTION i ON f.CODE_INSCRIPTION = i.CODE_INSCRIPTION 
        INNER JOIN APPRENANT a ON i.CODE_APPRENANT = a.CODE_APPRENANT 
        INNER JOIN ABSENCE abs ON a.CODE_APPRENANT = abs.CODE_APPRENANT 
        LEFT JOIN MOTIF_ABSENCE ma ON abs.CODE_MOTIF_ABSENCE = ma.CODE_MOTIF_ABSENCE 
        LEFT JOIN ABSENCE_DETAIL ad ON abs.CODE_ABSENCE = ad.CODE_ABSENCE 
        LEFT JOIN CALENDRIER c ON f.CODE_CALENDRIER = c.CODE_CALENDRIER 
        LEFT JOIN SESSION s ON c.CODE_SESSION = s.CODE_SESSION 
        WHERE g.CODE_GROUPE = ${group} 
        AND CONVERT(date, abs.DATE_DEB) BETWEEN '2025-08-25' AND '2026-08-23' 
        ORDER BY a.NOM_APPRENANT, ad.DATE_ABSENCE
      `,
      MATIERE: `
        SELECT g.CODE_GROUPE, m.CODE_MATIERE, r.CODE_PERIODE_EVALUATION, pe.NOM_PERIODE_EVALUATION, 
          r.CODE_REFERENTIEL, m.NOM_MATIERE, m.CODE_TYPE_MATIERE, rd.NUM_ORDRE, g.CODE_SITE, 
          r.CODE_ANNEE, a.NOM_ANNEE 
        FROM GROUPE g 
        INNER JOIN REFERENTIEL r ON g.CODE_FORMATION = r.CODE_FORMATION 
        INNER JOIN REFERENTIEL_DETAIL rd on r.CODE_REFERENTIEL = rd.CODE_REFERENTIEL 
        INNER JOIN MATIERE m ON rd.CODE_MATIERE = m.CODE_MATIERE 
        INNER JOIN PERIODE_EVALUATION pe ON r.CODE_PERIODE_EVALUATION = pe.CODE_PERIODE_EVALUATION
        INNER JOIN ANNEE a ON r.CODE_ANNEE = a.CODE_ANNEE
        WHERE g.CODE_GROUPE = ${group} 
          AND r.CODE_PERIODE_EVALUATION = ${periodeEvaluationCode} 
          AND pe.NOM_PERIODE_EVALUATION = '${periodeEvaluation}' 
          AND r.CODE_SESSION = 5 
          AND g.CODE_SITE = ${campus} 
          AND r.CODE_ANNEE = ${groupNumQuery}
        ORDER BY rd.NUM_ORDRE ASC, m.NOM_MATIERE
      `,
      MOYENNES_UE: `
        SELECT 
          g.CODE_GROUPE, g.NOM_GROUPE, ap.CODE_APPRENANT, ap.NOM_APPRENANT, ap.PRENOM_APPRENANT,
          m.CODE_MATIERE, m.NOM_MATIERE, rd.NUM_ORDRE, mm.MOYENNE, en.NOM_EVALUATION_NOTE,
          pe.NOM_PERIODE_EVALUATION, r.CODE_REFERENTIEL, r.NOM_REFERENTIEL
        FROM GROUPE g 
        INNER JOIN REFERENTIEL r ON g.CODE_FORMATION = r.CODE_FORMATION 
        INNER JOIN REFERENTIEL_DETAIL rd ON r.CODE_REFERENTIEL = rd.CODE_REFERENTIEL 
        INNER JOIN MATIERE m ON rd.CODE_MATIERE = m.CODE_MATIERE 
        INNER JOIN PERIODE_EVALUATION pe ON r.CODE_PERIODE_EVALUATION = pe.CODE_PERIODE_EVALUATION
        INNER JOIN FREQUENTE f ON g.CODE_GROUPE = f.CODE_GROUPE
        INNER JOIN INSCRIPTION i ON f.CODE_INSCRIPTION = i.CODE_INSCRIPTION
        INNER JOIN APPRENANT ap ON i.CODE_APPRENANT = ap.CODE_APPRENANT
        LEFT JOIN MOYENNE_MATIERE_PERIODE mm ON mm.CODE_MATIERE = m.CODE_MATIERE
          AND mm.CODE_GROUPE = g.CODE_GROUPE 
          AND mm.CODE_REFERENTIEL = r.CODE_REFERENTIEL
          AND mm.CODE_APPRENANT = ap.CODE_APPRENANT
        LEFT JOIN NOTE n ON n.CODE_APPRENANT = ap.CODE_APPRENANT 
          AND n.CODE_REFERENTIEL_DETAIL = rd.CODE_REFERENTIEL_DETAIL
        LEFT JOIN EVALUATION_NOTE en ON n.CODE_EVALUATION_NOTE = en.CODE_EVALUATION_NOTE
        WHERE g.CODE_GROUPE = ${group}
          AND r.CODE_PERIODE_EVALUATION = ${periodeEvaluationCode}
          AND pe.NOM_PERIODE_EVALUATION = '${periodeEvaluation}'
          AND r.CODE_SESSION = 5
          AND g.CODE_SITE = ${campus}
          AND (r.CODE_ANNEE = ${groupNumQuery} OR (r.CODE_ANNEE = 4 AND ${groupNumQuery} = 3))
          AND r.IS_DANS_MOYENNE = '1'
        ORDER BY ap.NOM_APPRENANT, ap.PRENOM_APPRENANT, rd.NUM_ORDRE, m.NOM_MATIERE
      `,
      MOYENNE_GENERALE: `
        SELECT 
          g.CODE_GROUPE, g.NOM_GROUPE, ap.CODE_APPRENANT, ap.NOM_APPRENANT, ap.PRENOM_APPRENANT,
          AVG(mp.MOYENNE) AS MOYENNE_GENERALE, pe.NOM_PERIODE_EVALUATION
        FROM GROUPE g 
        INNER JOIN FREQUENTE f ON g.CODE_GROUPE = f.CODE_GROUPE
        INNER JOIN INSCRIPTION i ON f.CODE_INSCRIPTION = i.CODE_INSCRIPTION
        INNER JOIN APPRENANT ap ON i.CODE_APPRENANT = ap.CODE_APPRENANT
        INNER JOIN REFERENTIEL r ON g.CODE_FORMATION = r.CODE_FORMATION 
        INNER JOIN PERIODE_EVALUATION pe ON r.CODE_PERIODE_EVALUATION = pe.CODE_PERIODE_EVALUATION
        LEFT JOIN MOYENNE_PERIODE mp ON mp.CODE_GROUPE = g.CODE_GROUPE 
          AND mp.CODE_APPRENANT = ap.CODE_APPRENANT
          AND mp.CODE_REFERENTIEL = r.CODE_REFERENTIEL
        WHERE g.CODE_GROUPE = ${group}
          AND r.CODE_PERIODE_EVALUATION = ${periodeEvaluationCode}
          AND pe.NOM_PERIODE_EVALUATION = '${periodeEvaluation}'
          AND r.CODE_SESSION = 5
          AND g.CODE_SITE = ${campus}
          AND (r.CODE_ANNEE = ${groupNumQuery} OR (r.CODE_ANNEE = 4 AND ${groupNumQuery} = 3))
        GROUP BY g.CODE_GROUPE, g.NOM_GROUPE, ap.CODE_APPRENANT, ap.NOM_APPRENANT, ap.PRENOM_APPRENANT, pe.NOM_PERIODE_EVALUATION
        ORDER BY ap.NOM_APPRENANT, ap.PRENOM_APPRENANT
      `,
      ECTS_PAR_MATIERE: `
        SELECT 
          g.CODE_GROUPE, g.NOM_GROUPE, ap.CODE_APPRENANT, ap.NOM_APPRENANT, ap.PRENOM_APPRENANT,
          m.CODE_MATIERE, m.CODE_TYPE_MATIERE, m.NOM_MATIERE, rd.NUM_ORDRE,
          COALESCE(rd.CREDIT_ECTS, 0) AS CREDIT_ECTS, pe.NOM_PERIODE_EVALUATION
        FROM GROUPE g 
        INNER JOIN REFERENTIEL r ON g.CODE_FORMATION = r.CODE_FORMATION 
        INNER JOIN REFERENTIEL_DETAIL rd ON r.CODE_REFERENTIEL = rd.CODE_REFERENTIEL 
        INNER JOIN MATIERE m ON rd.CODE_MATIERE = m.CODE_MATIERE 
        INNER JOIN PERIODE_EVALUATION pe ON r.CODE_PERIODE_EVALUATION = pe.CODE_PERIODE_EVALUATION
        INNER JOIN FREQUENTE f ON g.CODE_GROUPE = f.CODE_GROUPE
        INNER JOIN INSCRIPTION i ON f.CODE_INSCRIPTION = i.CODE_INSCRIPTION
        INNER JOIN APPRENANT ap ON i.CODE_APPRENANT = ap.CODE_APPRENANT
        INNER JOIN SESSION s ON i.CODE_SESSION = s.CODE_SESSION
        WHERE g.CODE_GROUPE = ${group}
          AND r.CODE_PERIODE_EVALUATION = ${periodeEvaluationCode}
          AND r.CODE_SESSION = 5
          AND g.CODE_SITE = ${campus}
          ${nomGroupe && nomGroupe.includes("Rentrée décalée")
            ? `AND r.CODE_ANNEE = ${codeAnnee}`
            : `AND (r.CODE_ANNEE = ${groupNumQuery} OR (r.CODE_ANNEE = 4 AND ${groupNumQuery} = 3))`
          }
        ORDER BY ap.NOM_APPRENANT, ap.PRENOM_APPRENANT, rd.NUM_ORDRE, m.NOM_MATIERE
      `,
      OBSERVATIONS: `
        SELECT 
          ap.CODE_OBSERVATION, o.MEMO_OBSERVATION, i.CODE_APPRENANT, 
          a.NOM_APPRENANT, a.PRENOM_APPRENANT, ap.CODE_REFERENTIEL,
          g.CODE_GROUPE, g.NOM_GROUPE
        FROM OBSERVATION o 
        INNER JOIN APPRECIATION_PERIODE ap ON o.CODE_OBSERVATION = ap.CODE_OBSERVATION 
        INNER JOIN INSCRIPTION i ON ap.CODE_INSCRIPTION = i.CODE_INSCRIPTION 
        INNER JOIN APPRENANT a ON i.CODE_APPRENANT = a.CODE_APPRENANT
        INNER JOIN FREQUENTE f ON i.CODE_INSCRIPTION = f.CODE_INSCRIPTION
        INNER JOIN GROUPE g ON f.CODE_GROUPE = g.CODE_GROUPE
        INNER JOIN REFERENTIEL r ON ap.CODE_REFERENTIEL = r.CODE_REFERENTIEL
        INNER JOIN PERIODE_EVALUATION pe ON r.CODE_PERIODE_EVALUATION = pe.CODE_PERIODE_EVALUATION
        WHERE g.CODE_GROUPE = ${group}
          AND r.CODE_SESSION = 5
          AND r.CODE_PERIODE_EVALUATION = ${periodeEvaluationCode}
          AND pe.NOM_PERIODE_EVALUATION = '${periodeEvaluation}'
          AND (r.CODE_ANNEE = ${groupNumQuery} OR (r.CODE_ANNEE = 4 AND ${groupNumQuery} = 3))
        ORDER BY a.NOM_APPRENANT, a.PRENOM_APPRENANT
      `,
      PERSONNEL: `
        SELECT DISTINCT p.CODE_PERSONNEL, g.CODE_PERSONNEL_GESTIONNAIRE, p.NOM_PERSONNEL, 
          p.PRENOM_PERSONNEL, p.CODE_FONCTION_PERSONNEL, fp.NOM_FONCTION_PERSONNEL 
        FROM GROUPE g 
        INNER JOIN PERSONNEL p ON g.CODE_PERSONNEL = p.CODE_PERSONNEL 
        INNER JOIN FONCTION_PERSONNEL fp ON p.CODE_FONCTION_PERSONNEL = fp.CODE_FONCTION_PERSONNEL 
        WHERE g.CODE_GROUPE = ${group}
      `,
      NOTES: `
        SELECT n.CODE_NOTE, n.VALEUR_NOTE, a.NOM_APPRENANT, m.NOM_MATIERE, r.CODE_PERIODE_EVALUATION 
        FROM NOTE n 
        INNER JOIN REFERENTIEL_DETAIL rd ON n.CODE_REFERENTIEL_DETAIL = rd.CODE_REFERENTIEL_DETAIL 
        INNER JOIN MATIERE m ON rd.CODE_MATIERE = m.CODE_MATIERE 
        INNER JOIN REFERENTIEL r ON rd.CODE_REFERENTIEL = r.CODE_REFERENTIEL 
        INNER JOIN APPRENANT a ON n.CODE_APPRENANT = a.CODE_APPRENANT 
        WHERE r.CODE_SESSION = 5 
          AND a.CODE_APPRENANT IN (
            SELECT i.CODE_APPRENANT FROM INSCRIPTION i 
            INNER JOIN FREQUENTE f ON i.CODE_INSCRIPTION = f.CODE_INSCRIPTION 
            WHERE f.CODE_GROUPE = ${group}
          )
      `,
    };

    // ✅ CORRECTION PRINCIPALE : Exécution parallèle de toutes les requêtes
    const queryEntries = Object.entries(queries) as [keyof QueryResults, string][];

    const queryResults = await Promise.all(
      queryEntries.map(([key, query]) =>
        executeQuery(query, token)
          .then((results) => ({ key, results, error: null }))
          .catch((error: any) => ({ key, results: [] as any[], error: error.message }))
      )
    );

    const results: Partial<QueryResults> = {};
    const formattedData: FormattedData = {
      timestamp: new Date().toISOString(),
      campus: campus.toString(),
      group: group.toString(),
      semester: semester,
      queries: {},
    };

    let hasSuccessfulQuery = false;
    let totalResults = 0;

    for (const { key, results: queryResult, error } of queryResults) {
      if (error) {
        console.error(`❌ Erreur pour ${key}:`, error);
        formattedData.queries[key] = { results: [], error };
      } else {
        if (queryResult.length > 0) {
          hasSuccessfulQuery = true;
          totalResults += queryResult.length;
        }
        results[key] = queryResult;
        formattedData.queries[key] = { results: queryResult };
      }
    }

    if (!hasSuccessfulQuery) {
      return NextResponse.json(
        {
          success: false,
          error: "Aucune donnée n'a été récupérée",
          details: "Toutes les requêtes ont échoué ou n'ont retourné aucun résultat",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: results,
      timestamp: formattedData.timestamp,
      totalResults,
    });
  } catch (error: any) {
    console.error("❌ Erreur générale:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération des données",
        details: error.message,
      },
      { status: 500 }
    );
  }
}