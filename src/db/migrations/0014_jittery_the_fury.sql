ALTER TABLE "skills" ADD CONSTRAINT "skills_user_id_id_unique" UNIQUE("user_id","id");
--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_user_skill_fk" FOREIGN KEY ("user_id","skill_id") REFERENCES "public"."skills"("user_id","id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "task_templates" DROP CONSTRAINT "task_templates_skill_id_skills_id_fk";
