"use client";

import { Progress } from "@/components/ui/progress";
import { useToast } from "@/components/ui/use-toast";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";
import { FileUp, Loader2, MousePointerSquareDashed } from "lucide-react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Dropzone, { FileRejection } from "react-dropzone";

const Page = () => {
  const { toast } = useToast();
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [missingFile, setMissingFile] = useState<string | null>(null);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [wordFile, setWordFile] = useState<File | null>(null);

  useEffect(() => {
    console.log("Session status: ", status);
    console.log("Session data: ", session);
    if (session) {
      console.log("Session user: ", session.user);
    }
  }, [session, status]);

  const { startUpload } = useUploadThing("excelUploader", {
    onClientUploadComplete: () => {
      console.log("Upload complete");
      const configId = session?.user?.id;
      startTransition(() => {
        console.log(`Redirecting to /configure/design?id=${configId}`);
        router.push(`/configure/design?id=${configId}`);
      });
    },
    onUploadProgress(p) {
      console.log(`Upload progress: ${p}`);
      setUploadProgress(p);
    },
  });

  const onDropRejected = (rejectedFiles: FileRejection[]) => {
    const [file] = rejectedFiles;

    setIsDragOver(false);

    console.log(`File rejected: ${file.file.name} of type ${file.file.type}`);

    toast({
      title: `${file.file.type} type is not supported.`,
      description: "Please choose a PNG, JPG, JPEG, Excel, or Word document instead.",
      variant: "destructive",
    });
  };

  const onDropAccepted = (acceptedFiles: File[]) => {
    const userId = session?.user?.id;

    console.log("Accepted files: ", acceptedFiles);
    console.log("User ID: ", userId);

    if (!userId) {
      toast({
        title: "User ID not found",
        description: "Please log in to upload files.",
        variant: "destructive",
      });
      return;
    }

    let hasExcel = false;
    let hasWord = false;

    acceptedFiles.forEach((file) => {
      if (file.name.endsWith(".xls") || file.name.endsWith(".xlsx")) {
        setExcelFile(file);
        hasExcel = true;
      } else if (file.name.endsWith(".doc") || file.name.endsWith(".docx")) {
        setWordFile(file);
        hasWord = true;
      }
    });

    if (!hasExcel) {
      setMissingFile("Extraction des notes manquante.");
    } else if (!hasWord) {
      setMissingFile("Document Word avec les appréciations manquant.");
    }

    setIsDragOver(false);
  };

  useEffect(() => {
    console.log("useEffect triggered");
    if (excelFile && wordFile) {
      const userId = session?.user?.id;
      console.log("User ID in useEffect: ", userId);
      if (userId) {
        console.log("Starting upload");
        setIsUploading(true);
        startUpload([excelFile, wordFile], { userId });
        setMissingFile(null);
      }
    }
  }, [excelFile, wordFile, session?.user?.id, startUpload]);

  const [isPending, startTransition] = useTransition();

  return (
    <div
      className={cn(
        "relative h-full flex-1 my-16 w-full rounded-xl bg-gray-900/5 p-2 ring-1 ring-inset ring-gray-900/10 lg:rounded-2xl flex justify-center flex-col items-center",
        {
          "ring-blue-900/25 bg-blue-900/10": isDragOver,
        }
      )}
    >
      <div className="relative flex flex-1 flex-col items-center justify-center w-full">
        <Dropzone
          onDropRejected={onDropRejected}
          onDropAccepted={onDropAccepted}
          maxFiles={2}
          accept={{
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
            "application/vnd.ms-excel": [".xls"],
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
            "application/msword": [".doc"],
          }}
          onDragEnter={() => setIsDragOver(true)}
          onDragLeave={() => setIsDragOver(false)}
        >
          {({ getRootProps, getInputProps }) => (
            <div
              className="h-full w-full flex-1 flex flex-col items-center justify-center"
              {...getRootProps()}
            >
              <input {...getInputProps()} />
              {isDragOver ? (
                <MousePointerSquareDashed className="h-6 w-6 text-zinc-500 mb-2" />
              ) : isUploading || isPending ? (
                <Loader2 className="animate-spin h-6 w-6 text-zinc-500 mb-2" />
              ) : (
                <FileUp className="h-6 w-6 text-zinc-500 mb-2" />
              )}
              <div className="flex flex-col justify-center mb-2 text-sm text-zinc-700">
                {isUploading ? (
                  <div className="flex flex-col items-center">
                    <p>Téléchargement...</p>
                    <Progress value={uploadProgress} className="mt-2 w-40 h-2 bg-gray-300" />
                  </div>
                ) : isPending ? (
                  <div className="flex flex-col items-center">
                    <p>Redirection, veuillez patienter...</p>
                  </div>
                ) : isDragOver ? (
                  <p>
                    <span className="font-semibold">Déposer un fichier</span> à télécharger
                  </p>
                ) : (
                  <p>
                    <span className="font-semibold">Cliquer pour télécharger</span> ou
                    glisser-déposer un Excel et un Word
                  </p>
                )}
                {missingFile && <p className="text-red-500 text-center">{missingFile}</p>}
              </div>

              {isPending ? null : (
                <p className="text-xs text-zinc-500">Excel (.xls, .xlsx), Word (.doc, .docx)</p>
              )}
            </div>
          )}
        </Dropzone>
      </div>
    </div>
  );
};

export default Page;
