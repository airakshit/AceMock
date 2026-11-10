ALTER TABLE "questions"
DROP COLUMN "not_ready_reason";

ALTER TABLE "questions"
RENAME COLUMN "failure_reason" TO "not_ready_reason";