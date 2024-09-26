/*
  Warnings:

  - You are about to drop the column `generatedBulletinUrl` on the `Configuration` table. All the data in the column will be lost.
  - You are about to drop the column `generatedExcelUrl` on the `Configuration` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Configuration" DROP COLUMN "generatedBulletinUrl",
DROP COLUMN "generatedExcelUrl",
ADD COLUMN     "generatedBulletins" BYTEA,
ADD COLUMN     "generatedExcel" BYTEA;
