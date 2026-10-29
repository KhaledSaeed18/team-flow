-- Hand edit: deleting a sprint returns its tasks to the backlog (SET NULL on sprint_id only).
CREATE TYPE "public"."sprint_status" AS ENUM('planned', 'active', 'completed');--> statement-breakpoint
CREATE TABLE "sprints" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"goal" text DEFAULT '' NOT NULL,
	"status" "sprint_status" DEFAULT 'planned' NOT NULL,
	"starts_at" timestamp (3) with time zone NOT NULL,
	"ends_at" timestamp (3) with time zone NOT NULL,
	"started_at" timestamp (3) with time zone,
	"completed_at" timestamp (3) with time zone,
	"committed_points" integer,
	"completed_points" integer,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sprints_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "sprints_project_key" UNIQUE("organization_id","project_id","id"),
	CONSTRAINT "sprints_dates" CHECK ("sprints"."ends_at" > "sprints"."starts_at")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD COLUMN "sprint_id" uuid;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_organization_id_project_id_projects_organization_id_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "sprints_one_active_per_project" ON "sprints" USING btree ("organization_id","project_id") WHERE "sprints"."status" = 'active';--> statement-breakpoint
CREATE INDEX "sprints_organization_id_project_id_starts_at_index" ON "sprints" USING btree ("organization_id","project_id","starts_at");--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_sprint_in_project_fk" FOREIGN KEY ("organization_id","project_id","sprint_id") REFERENCES "public"."sprints"("organization_id","project_id","id") ON DELETE SET NULL ("sprint_id") ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "tasks_sprint_idx" ON "tasks" USING btree ("organization_id","sprint_id") WHERE "tasks"."deleted_at" is null;