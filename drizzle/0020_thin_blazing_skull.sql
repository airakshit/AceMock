ALTER TABLE "mock_tests" ALTER COLUMN "allow_untimed" SET DEFAULT false;--> statement-breakpoint
-- Tests created before these rules were enforced kept their previous
-- behaviour: a running timer and unlimited retakes. Without this, every
-- pre-existing row would silently become untimed and single-attempt.
UPDATE "mock_tests" SET "allow_untimed" = false, "max_attempts" = 0;