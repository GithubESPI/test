-- CreateTable
CREATE TABLE "Configuration" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "excelUrl" TEXT NOT NULL,
    "wordUrl" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "generatedExcelUrl" TEXT,
    "generatedBulletinUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Configuration_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Configuration" ADD CONSTRAINT "Configuration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
