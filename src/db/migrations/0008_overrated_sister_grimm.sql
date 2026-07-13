CREATE UNIQUE INDEX "skills_user_active_name_unique" ON "skills" USING btree ("user_id",lower(btrim("name"))) WHERE "skills"."status" = 'active';--> statement-breakpoint
CREATE UNIQUE INDEX "task_templates_user_live_title_unique" ON "task_templates" USING btree ("user_id",lower(btrim("title"))) WHERE "task_templates"."archived_at" is null;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_theme_check" CHECK ("users"."theme" in ('light', 'dark', 'system'));--> statement-breakpoint
ALTER TABLE "user_attributes" ADD CONSTRAINT "user_attributes_xp_check" CHECK ("user_attributes"."xp" >= 0);--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_status_check" CHECK ("skills"."status" in ('active', 'archived'));--> statement-breakpoint
ALTER TABLE "user_skills" ADD CONSTRAINT "user_skills_xp_check" CHECK ("user_skills"."xp" >= 0);--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_type_check" CHECK ("quests"."type" in ('main', 'side', 'long_term'));--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_status_check" CHECK ("quests"."status" in ('draft', 'active', 'completed', 'archived'));--> statement-breakpoint
ALTER TABLE "quests" ADD CONSTRAINT "quests_reward_xp_check" CHECK ("quests"."reward_xp" between 0 and 10000);--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_base_xp_check" CHECK ("task_templates"."base_xp" between 5 and 250);--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_difficulty_check" CHECK ("task_templates"."difficulty" in ('easy', 'normal', 'hard', 'epic'));--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_recurrence_check" CHECK (("task_templates"."recurrence_type" = 'daily' and "task_templates"."weekdays" is null) or ("task_templates"."recurrence_type" = 'weekdays' and cardinality("task_templates"."weekdays") between 1 and 7 and "task_templates"."weekdays" <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_base_xp_check" CHECK ("tasks"."base_xp" between 5 and 250);--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_difficulty_check" CHECK ("tasks"."difficulty" in ('easy', 'normal', 'hard', 'epic'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_check" CHECK ("tasks"."status" in ('pending', 'completed', 'cancelled'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_estimated_minutes_check" CHECK ("tasks"."estimated_minutes" is null or "tasks"."estimated_minutes" between 1 and 1440);--> statement-breakpoint
ALTER TABLE "task_completions" ADD CONSTRAINT "task_completions_final_xp_check" CHECK ("task_completions"."final_xp" > 0);--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_amount_check" CHECK ("xp_transactions"."amount" <> 0);--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_scope_check" CHECK ("xp_transactions"."scope" in ('global', 'skill', 'attribute'));--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_source_type_check" CHECK ("xp_transactions"."source_type" in ('task_completion', 'quest_completion', 'achievement', 'manual_adjustment', 'reversal'));--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_base_xp_check" CHECK ("xp_transactions"."base_xp" >= 0);--> statement-breakpoint
ALTER TABLE "xp_transactions" ADD CONSTRAINT "xp_transactions_multiplier_check" CHECK ("xp_transactions"."multiplier" > 0);--> statement-breakpoint
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_counts_check" CHECK ("streaks"."current_count" >= 0 and "streaks"."best_count" >= "streaks"."current_count");