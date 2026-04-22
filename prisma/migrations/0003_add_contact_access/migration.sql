CREATE TABLE "ContactAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    CONSTRAINT "ContactAccess_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactAccess_userId_contactId_key" ON "ContactAccess"("userId", "contactId");

ALTER TABLE "ContactAccess" ADD CONSTRAINT "ContactAccess_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactAccess" ADD CONSTRAINT "ContactAccess_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
