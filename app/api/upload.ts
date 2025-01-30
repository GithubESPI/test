import { NextApiRequest, NextApiResponse } from "next";
import fetch from "node-fetch";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId, excelUrl, wordUrl } = req.body;

  if (!sessionId || !excelUrl || !wordUrl) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  try {
    const response = await fetch(
      "https://bulletins-app.fly.dev/upload-and-integrate-excel-and-word",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          user_Id,
          excelUrl,
          wordUrl,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Backend responded with status ${response.status}: ${errorText}`
      );
    }

    const data = await response.json();

    // Add CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    return res.status(200).json(data);
  } catch (error: unknown) {
    console.error("Error processing upload:", error);

    if (error instanceof Error) {
      return res.status(500).json({ 
        error: "Failed to process upload",
        details: error.message 
      });
    }

    return res.status(500).json({ 
      error: "An unknown error occurred during upload" 
    });
  }
}

// Handle CORS preflight requests
export const config = {
  api: {
    bodyParser: true,
    externalResolver: true,
  },
};
