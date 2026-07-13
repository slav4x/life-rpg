ALTER TABLE "task_templates" ADD COLUMN "starts_on" date DEFAULT current_date NOT NULL;--> statement-breakpoint
ALTER TABLE "task_templates" ADD COLUMN "ends_on" date;--> statement-breakpoint
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_date_range_check" CHECK ("task_templates"."ends_on" is null or "task_templates"."ends_on" >= "task_templates"."starts_on");