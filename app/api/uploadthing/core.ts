import { prisma } from "@/lib/db";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { z } from "zod";

const f = createUploadthing();

export const ourFileRouter = {
  excelUploader: f({
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxFileSize: "4GB" },
    "application/vnd.ms-excel": { maxFileSize: "4GB" },
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": {
      maxFileSize: "4GB",
    },
    "application/msword": { maxFileSize: "4GB" },
  })
    .input(z.object({ userId: z.string() }))
    .middleware(async ({ input }) => {
      return { input };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.log("File metadata:", metadata);
      console.log("Uploaded file details:", file);
      const { userId } = metadata.input;

      const isExcelFile =
        file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
        file.type === "application/vnd.ms-excel";
      const isWordFile =
        file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        file.type === "application/msword";

      console.log("isExcelFile:", isExcelFile, "isWordFile:", isWordFile);

      const existingConfig = await prisma.configuration.findFirst({
        where: { userId: userId },
      });

      if (existingConfig) {
        // Mise à jour de la configuration existante
        const updatedData: {
          excelUrl?: string;
          wordUrl?: string;
          updatedAt: Date;
        } = { updatedAt: new Date() };

        if (isExcelFile) {
          updatedData.excelUrl = file.url;
        }
        if (isWordFile) {
          updatedData.wordUrl = file.url;
        }

        try {
          const updatedConfiguration = await prisma.configuration.update({
            where: {
              id: existingConfig.id,
            },
            data: updatedData,
          });
          console.log("Updated configuration:", updatedConfiguration);
          return { configId: updatedConfiguration.id };
        } catch (error) {
          console.error("Failed to update configuration:", error);
        }
      } else {
        try {
          const initialData = {
            fileName: "excel-et-word",
            userId: userId,
            excelUrl: isExcelFile ? file.url : "excel manquant",
            wordUrl: isWordFile ? file.url : "word manquant",
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          try {
            const configuration = await prisma.configuration.create({
              data: initialData,
            });
            return { configId: configuration.id };
          } catch (error) {
            console.error("Error creating configuration:", error);
            throw new Error("Failed to create configuration");
          }
        } catch (error) {
          console.error("Failed to create configuration:", error);
        }
      }
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
