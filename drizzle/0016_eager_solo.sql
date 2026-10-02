ALTER TABLE "question_bookmarks" DROP CONSTRAINT "question_bookmarks_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "question_bookmarks" ADD PRIMARY KEY ("id");--> statement-breakpoint
ALTER TABLE "question_bookmarks" ADD COLUMN "user_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "question_bookmarks" ADD CONSTRAINT "question_bookmarks_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_bookmarks" ADD CONSTRAINT "question_bookmarks_user_id_question_id_unique" UNIQUE("user_id","question_id");