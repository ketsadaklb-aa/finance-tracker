-- Add transferGroupId to Transaction so the two legs of a transfer can be paired.
-- transfer-out (debits source) and transfer-in (credits destination) share the same id.

ALTER TABLE "Transaction" ADD COLUMN "transferGroupId" TEXT;

CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");
