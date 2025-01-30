import { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end(); // Method Not Allowed
  }

  const { userId, excelUrl, wordUrl } = req.body;

  try {
    // Première étape : Traitement Excel
    const excelResponse = await fetch("https://bulletins-app.fly.dev/process-excel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        excel_url: excelUrl,
        word_url: wordUrl,
        user_id: userId,
      }),
    });

    if (!excelResponse.ok) {
      const errorText = await excelResponse.text();
      throw new Error(errorText || "Unknown error");
    }

    const excelData = await excelResponse.json();

    // Deuxième étape : Génération Word
    const wordResponse = await fetch("https://bulletins-app.fly.dev/get-word-template", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        user_id: userId,
      }),
    });

    if (!wordResponse.ok) {
      throw new Error("Erreur lors de la génération du template Word");
    }

    const wordData = await wordResponse.json();

    res.status(200).json({
      excel: excelData,
      word: wordData
    });
  } catch (error: unknown) {
    if (error instanceof Error) {
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
}
