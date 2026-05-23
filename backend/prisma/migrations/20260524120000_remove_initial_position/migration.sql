-- Drop unused column: games always start from standard chess position.
ALTER TABLE "Game" DROP COLUMN IF EXISTS "initialPosition";
