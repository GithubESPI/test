import { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).end(); // Method Not Allowed
  }

  const { sessionId, excelUrl, wordUrl } = req.body;

  try {
    const response = await fetch(
      "https://bulletins-app.fly.dev/upload-and-integrate-excel-and-word",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          excelUrl,
          wordUrl,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || "Unknown error");
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error: unknown) {
    // Remplacez `any` par `unknown`
    if (error instanceof Error) {
      // Vérifiez si l'erreur est une instance d'Error
      res.status(500).json({ error: error.message });
    } else {
      res.status(500).json({ error: "An unknown error occurred" });
    }
  }
}
