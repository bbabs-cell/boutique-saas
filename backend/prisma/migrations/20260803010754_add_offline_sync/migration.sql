/*
  Warnings:

  - A unique constraint covering the columns `[clientId]` on the table `sales` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "sales_clientId_key" ON "sales"("clientId");
