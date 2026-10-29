-- Hand edits: member references use ON DELETE SET NULL (column) so removing a member keeps organization_id;
-- rank uses the "C" collation so fractional keys sort by bytes (ADR-0008).
CREATE TYPE "public"."status_category" AS ENUM('backlog', 'unstarted', 'started', 'completed', 'canceled');--> statement-breakpoint
CREATE TABLE "labels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "labels_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"color" text DEFAULT '#6366f1' NOT NULL,
	"lead_member_id" uuid,
	"task_sequence" integer DEFAULT 0 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"archived_at" timestamp (3) with time zone,
	"created_by_member_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "projects_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "projects_key_format" CHECK ("projects"."key" ~ '^[A-Z][A-Z0-9]{1,5}$')
);
--> statement-breakpoint
CREATE TABLE "workflow_statuses" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"name" text NOT NULL,
	"category" "status_category" NOT NULL,
	"color" text NOT NULL,
	"rank" text COLLATE "C" NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_statuses_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "labels" ADD CONSTRAINT "labels_organization_id_project_id_projects_organization_id_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_lead_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","lead_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("lead_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_created_by_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","created_by_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("created_by_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_statuses" ADD CONSTRAINT "workflow_statuses_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workflow_statuses" ADD CONSTRAINT "workflow_statuses_organization_id_project_id_projects_organization_id_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "labels_name_unique" ON "labels" USING btree ("organization_id",coalesce("project_id", '00000000-0000-0000-0000-000000000000'),lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "projects_organization_id_key_index" ON "projects" USING btree ("organization_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX "workflow_statuses_name_unique" ON "workflow_statuses" USING btree ("organization_id","project_id",lower("name"));--> statement-breakpoint
CREATE INDEX "workflow_statuses_organization_id_project_id_rank_index" ON "workflow_statuses" USING btree ("organization_id","project_id","rank");