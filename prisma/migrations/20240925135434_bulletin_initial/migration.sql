-- CreateTable
CREATE TABLE "GeneratedFile" (
    "id" SERIAL NOT NULL,
    "filename" TEXT NOT NULL,
    "fileData" BYTEA NOT NULL,

    CONSTRAINT "GeneratedFile_pkey" PRIMARY KEY ("id")
);
