CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DeckCard" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "cardApiId" INTEGER NOT NULL,
    "cardName" TEXT NOT NULL,
    "cardImage" TEXT NOT NULL,
    "cardType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "atk" INTEGER,
    "def" INTEGER,
    "level" INTEGER,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DeckCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AppDocument" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppDocument_pkey" PRIMARY KEY ("key")
);

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX "DeckCard_ownerId_section_cardApiId_key" ON "DeckCard"("ownerId", "section", "cardApiId");
CREATE INDEX "DeckCard_ownerId_section_idx" ON "DeckCard"("ownerId", "section");
CREATE INDEX "DeckCard_cardApiId_idx" ON "DeckCard"("cardApiId");
ALTER TABLE "DeckCard" ADD CONSTRAINT "DeckCard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
