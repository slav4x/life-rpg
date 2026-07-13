ALTER TABLE "task_templates" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "priority" text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_priority_check" CHECK ("task_templates"."priority" in ('high', 'normal', 'low'));--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_priority_check" CHECK ("tasks"."priority" in ('high', 'normal', 'low'));