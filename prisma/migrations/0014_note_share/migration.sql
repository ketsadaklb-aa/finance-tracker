
-- AlterTable
ALTER TABLE "Note" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Note_shareToken_key" ON "Note"("shareToken");

