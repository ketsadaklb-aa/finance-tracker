
-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "assigneeId" TEXT,
ADD COLUMN     "checklist" JSONB,
ADD COLUMN     "dueTime" TEXT;

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

