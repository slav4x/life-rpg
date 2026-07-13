CREATE TABLE "quest_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quest_id" uuid NOT NULL,
	"reward_xp" integer NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reverted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quest_completions_reward_xp_check" CHECK ("quest_completions"."reward_xp" >= 0)
);
--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "estimated_minutes" integer;--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quest_completions" ADD CONSTRAINT "quest_completions_quest_id_quests_id_fk" FOREIGN KEY ("quest_id") REFERENCES "public"."quests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "quest_completions" ("id", "user_id", "quest_id", "reward_xp", "completed_at", "created_at")
SELECT "id", "user_id", "id", "reward_xp", coalesce("completed_at", "updated_at"), coalesce("completed_at", "updated_at")
FROM "quests"
WHERE "status" = 'completed';--> statement-breakpoint
CREATE UNIQUE INDEX "quest_completions_active_quest_unique" ON "quest_completions" USING btree ("user_id","quest_id") WHERE "quest_completions"."reverted_at" is null;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_estimated_minutes_check" CHECK ("task_templates"."estimated_minutes" is null or "task_templates"."estimated_minutes" between 1 and 1440);
