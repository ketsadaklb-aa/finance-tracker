-- AlterTable
ALTER TABLE "Contact" ADD COLUMN     "sharePinHash" TEXT,
ADD COLUMN     "shareToken" TEXT,
ADD COLUMN     "sharedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Contact_shareToken_key" ON "Contact"("shareToken");
