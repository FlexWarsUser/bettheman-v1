-- Multi-tenant houses for licensed books.
-- Safe to run on Neon: additive columns + backfill into house 1.

CREATE TABLE IF NOT EXISTS "House" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "logoUrl" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "HouseSetting" (
  "id" SERIAL PRIMARY KEY,
  "houseId" INTEGER NOT NULL,
  "key" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HouseSetting_houseId_fkey"
    FOREIGN KEY ("houseId") REFERENCES "House"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "HouseSetting_houseId_key_key" ON "HouseSetting"("houseId", "key");
CREATE INDEX IF NOT EXISTS "HouseSetting_houseId_idx" ON "HouseSetting"("houseId");

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "houseId" INTEGER;
ALTER TABLE "Bet" ADD COLUMN IF NOT EXISTS "houseId" INTEGER;
ALTER TABLE "Event" ADD COLUMN IF NOT EXISTS "houseId" INTEGER;

CREATE INDEX IF NOT EXISTS "User_houseId_idx" ON "User"("houseId");
CREATE INDEX IF NOT EXISTS "Bet_houseId_idx" ON "Bet"("houseId");
CREATE INDEX IF NOT EXISTS "Event_houseId_idx" ON "Event"("houseId");

INSERT INTO "House" ("id", "name", "slug", "active", "createdAt", "updatedAt")
VALUES (1, 'BetTheStag', 'betthestags', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "House" ("id", "name", "slug", "active", "createdAt", "updatedAt")
SELECT 1, 'BetTheStag', 'betthestags', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "House" WHERE "id" = 1);

SELECT setval(pg_get_serial_sequence('"House"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "House"), 1), true);

UPDATE "User" SET "houseId" = 1 WHERE "houseId" IS NULL;
UPDATE "Bet" SET "houseId" = 1 WHERE "houseId" IS NULL;
UPDATE "Event" SET "houseId" = 1 WHERE "houseId" IS NULL;

-- Existing book: user 7 stays admin and is also the house master for house 1.
UPDATE "User" SET "houseId" = 1 WHERE "id" = 7;
