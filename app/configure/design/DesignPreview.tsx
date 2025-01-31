"use client";

import Bulletin from "@/components/Bulletin";
import LoginModal from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

// Fonction de journalisation détaillée
const log = (message: string, error: boolean = false) => {
  console[error ? "error" : "log"](`[LOG] ${message}`);
};

// Vérification de l'accès à une URL
const checkUrlAccess = async (url: string): Promise<void> => {
  try {
    log(`🔍 Vérification d'accès à l'URL: ${url}`);
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`⛔ Accès refusé à l'URL: ${url}`);
    }
    log(`✅ Accès confirmé: ${url}`);
  } catch (error: unknown) {
    log(`❌ Erreur d'accès à l'URL: ${url}`, true);
    throw error;
  }
};

const DesignPreview = () => {
  const { data: session } = useSession();
  const sessionId = session?.user?.id ?? "";

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [modalMessage, setModalMessage] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const websocketRef = useRef<WebSocket | null>(null);

  // Vérification et téléchargement du fichier ZIP
  const downloadZip = async () => {
    log("📡 Vérification du fichier ZIP avant téléchargement...");
    const response = await fetch("https://bulletins-app.fly.dev/download-zip/bulletins.zip", { method: "HEAD" });

    if (!response.ok) {
      log(`❌ Fichier ZIP introuvable. Code HTTP: ${response.status}`, true);
      setModalMessage("Erreur : Le fichier ZIP n'est pas encore prêt.");
      return;
    }

    log("✅ Le fichier ZIP est accessible, lancement du téléchargement !");
    const link = document.createElement("a");
    link.href = "https://bulletins-app.fly.dev/download-zip/bulletins.zip";
    link.setAttribute("download", "bulletins.zip");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setIsModalOpen(true);
    setIsSuccess(null);
    setModalMessage("📤 Envoi des fichiers au serveur...");
    log("🚀 Lancement du processus de génération.");

    try {
      log("📡 Récupération des documents depuis l'API Next.js...");
      const response = await fetch(`/api/documents?userId=${sessionId}`);
      if (!response.ok) throw new Error(`HTTP Error! Status: ${response.status}`);

      const data = await response.json();
      log(`📂 Documents récupérés: ${JSON.stringify(data)}`);

      await checkUrlAccess(data.excelUrl);
      await checkUrlAccess(data.wordUrl);

      log("📡 Envoi des fichiers à FastAPI...");
      const generateResponse = await fetch(`https://bulletins-app.fly.dev/upload-and-integrate-excel-and-word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, excelUrl: data.excelUrl, wordUrl: data.wordUrl }),
      });

      if (!generateResponse.ok) throw new Error(await generateResponse.text());

      const generateData = await generateResponse.json();
      log(`📜 Réponse FastAPI: ${JSON.stringify(generateData)}`);

      if (generateData.message.includes("Files processed and zipped successfully")) {
        setIsSuccess(true);
        setModalMessage("📁 Bulletins prêts. Téléchargement en cours...");
        await downloadZip();
      }
    } catch (error) {
      log(`❌ Erreur: ${error}`, true);
      setIsSuccess(false);
      setModalMessage("Erreur lors de la génération.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <div className="mt-20 flex flex-col items-center">
        <Bulletin className={cn("max-w-[150px]")} imgSrc="" />
        <h3 className="text-3xl font-bold">Vos documents ont bien été déposés.</h3>
        <Button className="mt-6 px-6" onClick={handleGenerate} disabled={isLoading}>
          {isLoading ? <LoaderCircle className="animate-spin" /> : <>Générer vos bulletins <ArrowRight className="h-4 w-4 ml-1.5 inline" /></>}
        </Button>
      </div>
      <LoginModal isOpen={isModalOpen} setIsOpen={setIsModalOpen} title={isLoading ? "Génération en cours" : isSuccess ? "Félicitations" : "Oups"} description={modalMessage}>
        {isLoading && <Progress value={progress} />}
      </LoginModal>
    </>
  );
};

export default DesignPreview;
