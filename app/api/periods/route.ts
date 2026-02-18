import { fetchWithRetry } from "@/lib/fetchWithRetry";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const token = process.env.TOKEN_REQUETEUR!;
    const url = process.env.URL_REQUETEUR!;

    if (!token || !url) {
      throw new Error("Variables d'environnement TOKEN_REQUETEUR ou URL_REQUETEUR manquantes");
    }

    const responseData = await fetchWithRetry(url, {
      method: "POST",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sql: "SELECT * FROM PERIODE_EVALUATION ORDER BY NOM_PERIODE_EVALUATION",
      }),
    });

    const periodsArray = Array.isArray(responseData) ? responseData : Object.values(responseData);

    return NextResponse.json({
      success: true,
      data: periodsArray,
    });
  } catch (error) {
    console.error("Erreur lors de la récupération des périodes:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Erreur lors de la récupération des périodes d'évaluation",
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}