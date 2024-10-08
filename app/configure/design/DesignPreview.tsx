"use client";

import Bulletin from "@/components/Bulletin";
import LoginModal from "@/components/LoginModal";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRef, useState } from "react";

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

  // const [isImportingFromDirectory, setIsImportingFromDirectory] = useState<boolean>(false);
  // const [showImportButton, setShowImportButton] = useState<boolean>(false); // Ajout d'un état pour contrôler l'affichage du bouton d'importation

  const websocketRef = useRef<WebSocket | null>(null);

  const initializeWebSocket = (sessionId: string) => {
    const ws = new WebSocket(`ws://localhost:8000/ws/progress/${sessionId}`);
    websocketRef.current = ws;

    ws.onopen = () => {
      log("WebSocket connection established");
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      log("WebSocket message received:", data);
      setProgress(data.progress);
    };

    ws.onclose = () => {
      log("WebSocket connection closed");
      websocketRef.current = null;
    };
  };

  const handleGenerate = async () => {
    setIsLoading(true);
    setIsModalOpen(true);
    setIsSuccess(null);
    setModalMessage("Chargement ...");

    try {
      const response = await fetch(`/api/documents?userId=${sessionId}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      await checkUrlAccess(data.excelUrl);
      await checkUrlAccess(data.wordUrl);

      // Initialize WebSocket connection to receive progress updates
      initializeWebSocket(sessionId);

      const generateResponse = await fetch(
        "http://localhost:8000/upload-and-integrate-excel-and-word",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sessionId: sessionId,
            excelUrl: data.excelUrl,
            wordUrl: data.wordUrl,
          }),
        }
      );

      if (!generateResponse.ok) {
        const errorText = await generateResponse.text();
        throw new Error(errorText || "Unknown error during document generation");
      }

      const generateData = await generateResponse.json();

      if (generateData.message.includes("Failed to fetch API data")) {
        setModalMessage(
          "Impossible de récupérer les données de Yparéo. Veuillez réessayer plus tard."
        );
      } else if (generateData.message.includes("zipped successfully")) {
        setIsSuccess(true);
        setModalMessage(
          "Les bulletins sont dans le dossier de téléchargement de votre navigateur."
        );
        // setShowImportButton(true); // Affiche le bouton d'importation après un succès
        const link = document.createElement("a");
        link.href = `http://localhost:8000/download-zip/${encodeURIComponent(
          generateData.zip_path.split("\\").pop() || ""
        )}`;
        link.setAttribute("download", "bulletins.zip");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } else {
        setIsSuccess(false);
        setModalMessage(
          "Erreur lors de la génération des bulletins. Veuillez vérifier les détails."
        );
      }
    } catch (error) {
      log(`Error generating documents: ${error}`, true);
      setIsSuccess(false);
      setModalMessage("Erreur lors de la génération des documents.");
    } finally {
      setIsLoading(false);
      if (websocketRef.current) {
        websocketRef.current.close(); // Close WebSocket connection
      }
    }
  };

  // const handleImportFromDirectory = async () => {
  //   setIsImportingFromDirectory(true);
  //   setModalMessage("Importation des bulletins depuis le répertoire en cours...");

  //   try {
  //     const response = await fetch("http://localhost:8000/import-bulletins-from-directory", {
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

  return (
    <div>
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
                <div>
                  Générer vos bulletins
                  <ArrowRight className="h-4 w-4 ml-1.5 inline" />
                </div>
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
        title={isLoading ? "Génération en cours" : isSuccess ? "Félicitations" : "Oups"}
        description={modalMessage}
      >
        {isLoading && <Progress value={progress} className="w-full" />}
      </LoginModal>
    </div>
  );
};

export default DesignPreview;
