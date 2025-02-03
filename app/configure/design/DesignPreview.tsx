"use client";

import Bulletin from "@/components/Bulletin";
import LoginModal from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

/* eslint-disable no-console */
// Fonction de journalisation
const log = (message: string, error: boolean = false) => {
  if (process.env.NODE_ENV === "development") {
    error ? console.error(message) : console.log(message);
  }
};
/* eslint-enable no-console */

const checkUrlAccess = async (url: string): Promise<void> => {
  try {
    const response = await fetch(url, { method: "HEAD" });
    if (!response.ok) {
      throw new Error(`Access denied to URL: ${url}`);
    }
  } catch (error: unknown) {
    log(`Failed to access URL: ${url}`, true);
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

  const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "https://bulletins-app.fly.dev";
  const WS_BASE_URL =
    process.env.NEXT_PUBLIC_WS_BASE_URL || "wss://bulletins-app.fly.dev/ws/progress";

  // const [isImportingFromDirectory, setIsImportingFromDirectory] = useState<boolean>(false);
  // const [showImportButton, setShowImportButton] = useState<boolean>(false); // Ajout d'un état pour contrôler l'affichage du bouton d'importation

  const websocketRef = useRef<WebSocket | null>(null);

  const reconnectWebSocket = (sessionId: string) => {
    if (progress === 100) {
      log("✅ Progression complète, pas de reconnexion WebSocket.");
      return;
    }

    log("🔄 Tentative de reconnexion au WebSocket...");
    setTimeout(() => initializeWebSocket(sessionId), 3000); // Reconnexion après 3 secondes
  };

  const initializeWebSocket = (sessionId: string) => {
    if (progress === 100) {
      log("✅ Progression complète, pas de reconnexion WebSocket.");
      return;
    }

    if (websocketRef.current) {
      log("⚠️ WebSocket déjà actif, pas besoin de recréer.");
      return;
    }

    const ws = new WebSocket(`${WS_BASE_URL}/${sessionId}`);
    websocketRef.current = ws;

    ws.onopen = () => {
      log("✅ WebSocket connection établie");
    };

    ws.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      log(`📩 WebSocket message reçu: ${JSON.stringify(data)}`);

      if (data.progress !== undefined) {
        setProgress(data.progress);
        setModalMessage(`Progression: ${data.progress}%`);
      }

      if (data.progress === 100) {
        log("✅ WebSocket a atteint 100%, vérification du fichier ZIP...");
        setModalMessage("✅ Génération terminée ! Vérification du fichier...");

        const zipReady = await pollDownloadStatus(); // Vérifie si le fichier ZIP est bien prêt

        if (zipReady) {
          log("📥 Téléchargement du fichier ZIP...");
          const link = document.createElement("a");
          link.href = `${API_BASE_URL}/download-zip/${sessionId}.zip`;
          link.setAttribute("download", `bulletins_${sessionId}.zip`);
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          setIsSuccess(true); // Met à jour l'état après le téléchargement réussi
          setModalMessage("✅ Téléchargement réussi ! Vos bulletins sont prêts.");
          ws.close(); // Fermer WebSocket après confirmation du fichier
        } else {
          setIsSuccess(false);
          setModalMessage("❌ Le fichier ZIP n'est pas encore prêt. Réessayez plus tard.");
        }
      }
    };

    ws.onerror = (error) => {
      log(`❌ WebSocket error: ${error}`);
    };

    ws.onclose = (event) => {
      log(`⚠️ WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
      if (!event.wasClean) {
        log("❌ WebSocket interrompu, tentative de reconnexion...");
        reconnectWebSocket(sessionId);
      }
    };
  };

  const pollDownloadStatus = async () => {
    const maxAttempts = 20; // Augmente le nombre de tentatives
    let attempt = 0;

    while (attempt < maxAttempts) {
      log(`🔍 Vérification du fichier ZIP (tentative ${attempt + 1}/${maxAttempts})`);

      try {
        const response = await fetch(`${API_BASE_URL}/download-zip/${sessionId}.zip`, {
          method: "HEAD",
        });

        if (response.ok) {
          log("📦 Fichier ZIP disponible pour téléchargement !");
          return true;
        }
      } catch (error) {
        log(`Erreur lors de la vérification du ZIP : ${error}`, true);
      }

      await new Promise((resolve) => setTimeout(resolve, 5000)); // Attend 5 secondes avant de réessayer
      attempt++;
    }

    log("❌ Fichier ZIP toujours indisponible après plusieurs tentatives.");
    return false;
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setIsModalOpen(true);
    setIsSuccess(null);
    setModalMessage("Envoi des fichiers au serveur...");

    try {
      // Récupérer les documents Excel et Word depuis Next.js API
      const response = await fetch(`/api/documents?userId=${sessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      await checkUrlAccess(data.excelUrl);
      await checkUrlAccess(data.wordUrl);

      // Initialiser la connexion WebSocket
      initializeWebSocket(sessionId);
      setModalMessage("Traitement en cours...");

      // Envoyer les fichiers à FastAPI sur Fly.io
      const generateResponse = await fetch(`${API_BASE_URL}/upload-and-integrate-excel-and-word`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: sessionId,
          excelUrl: data.excelUrl,
          wordUrl: data.wordUrl,
        }),
      });

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        throw new Error(errorText || "Erreur inconnue lors de la génération des documents");
      }

      const generateData = await generateResponse.json();

      if (generateData.message.includes("Files processed and zipped successfully")) {
        setIsSuccess(true);
        setModalMessage("Les bulletins sont prêts. Vérification du fichier ZIP en cours...");

        if (await pollDownloadStatus()) {
          const link = document.createElement("a");
          link.href = `${API_BASE_URL}/download-zip/${sessionId}.zip`;
          link.setAttribute("download", "bulletins.zip");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        } else {
          setIsSuccess(false);
          setModalMessage("Le fichier ZIP n'est pas encore prêt. Veuillez réessayer plus tard.");
        }
      }
    } catch (error) {
      log(`Erreur lors de la génération des documents: ${error}`, true);
      setIsSuccess(false);
      setModalMessage("Erreur lors de la génération des documents.");
    } finally {
      setIsLoading(false);
      if (websocketRef.current) {
        websocketRef.current.close();
      }
    }
  };

  // const handleImportFromDirectory = async () => {
  //   setIsImportingFromDirectory(true);
  //   setModalMessage("Importation des bulletins depuis le répertoire en cours...");

  //   try {
  //     const response = await fetch("https://backendespi.fly.dev/import-bulletins-from-directory", {
  //       method: "POST",
  //     });

  //     if (!response.ok) {
  //       const errorText = await response.text();
  //       throw new Error(errorText || "Unknown error during import from directory");
  //     }

  //     const data = await response.json();
  //     setModalMessage(`Importation terminée : ${data.message}`);
  //   } catch (error) {
  //     log(`Error importing documents from directory: ${error}`, true);
  //     setModalMessage("Erreur lors de l'importation des bulletins depuis le répertoire.");
  //   } finally {
  //     setIsImportingFromDirectory(false);
  //   }
  // };

  useEffect(() => {
    if (isSuccess) {
      setTimeout(() => {
        setIsModalOpen(false);
      }, 5000); // Ferme la modal après 5 secondes
    }
  }, [isSuccess]);

  return (
    <>
      <div className="mt-20 flex flex-col items-center md:grid text-sm sm:grid-cols-12 sm:grid-rows-1 sm:gap-x-6 md:gap-x-8 lg:gap-x-12">
        <div className="md:col-span-4 lg:col-span-3 md:row-span-2 md:row-end-2">
          <Bulletin className={cn("max-w-[150px] md:max-w-full")} imgSrc="" />
        </div>
        <div className="mt-6 sm:col-span-9 md:row-end-1">
          <h3 className="text-3xl font-bold tracking-tight text-gray-900">
            Vos documents ont bien été déposés.
          </h3>
          <div className="mt-3 flex items-center gap-1.5 text-base"></div>
        </div>

        <div className="sm:col-span-12 md:col-span-9 text-base">
          <div className="flex justify-start pb-12">
            {/* Le bouton de génération de documents */}
            <Button className="px-4 sm:px-6 lg:px-8" onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? (
                <LoaderCircle className="animate-spin" />
              ) : (
                <>
                  Générer vos bulletins
                  <ArrowRight className="h-4 w-4 ml-1.5 inline" />
                </>
              )}
            </Button>
            &nbsp;&nbsp;
            {/* Le bouton d'importation qui apparait après la génération */}
            {/* {showImportButton && (
              <Button
                className="pr-4 pl-2 sm:px-6 lg:px-8"
                onClick={handleImportFromDirectory}
                disabled={isImportingFromDirectory}
              >
                {isImportingFromDirectory ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <>
                    Importer sur Yparéo
                    <ArrowRight className="h-4 w-4 ml-1.5 inline" />
                  </>
                )}
              </Button>
            )} */}
          </div>
        </div>
      </div>

      <LoginModal
        isOpen={isModalOpen}
        setIsOpen={setIsModalOpen}
        title={isSuccess ? "Félicitations" : "Oups"}
        description={modalMessage}
      >
        {isLoading && <Progress value={progress} className="w-full" />}
      </LoginModal>
    </>
  );
};

export default DesignPreview;
