-- Hand edits: member references use ON DELETE SET NULL (column) so removing a member keeps organization_id;
-- rank uses the "C" collation so fractional keys sort by bytes (ADR-0008).
CREATE TYPE "public"."task_priority" AS ENUM('urgent', 'high', 'medium', 'low', 'none');--> statement-breakpoint
CREATE TYPE "public"."task_relation_type" AS ENUM('blocks', 'relates', 'duplicates');--> statement-breakpoint
CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid,
	"task_id" uuid,
	"actor_member_id" uuid,
	"kind" text NOT NULL,
	"changes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "activity_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "outbox" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp (3) with time zone,
	CONSTRAINT "outbox_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "task_labels" (
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"label_id" uuid NOT NULL,
	CONSTRAINT "task_labels_organization_id_task_id_label_id_pk" PRIMARY KEY("organization_id","task_id","label_id")
);
--> statement-breakpoint
CREATE TABLE "task_relations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"type" "task_relation_type" NOT NULL,
	"source_task_id" uuid NOT NULL,
	"target_task_id" uuid NOT NULL,
	"created_by_member_id" uuid,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_relations_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "task_relations_not_self" CHECK ("task_relations"."source_task_id" <> "task_relations"."target_task_id")
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"status_id" uuid NOT NULL,
	"priority" "task_priority" DEFAULT 'none' NOT NULL,
	"estimate" integer,
	"assignee_member_id" uuid,
	"parent_task_id" uuid,
	"due_date" date,
	"rank" text COLLATE "C" NOT NULL,
	"started_at" timestamp (3) with time zone,
	"completed_at" timestamp (3) with time zone,
	"canceled_at" timestamp (3) with time zone,
	"created_by_member_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "tasks_organizationId_id_unique" UNIQUE("organization_id","id"),
	CONSTRAINT "tasks_estimate_range" CHECK ("tasks"."estimate" is null or "tasks"."estimate" between 0 and 100),
	CONSTRAINT "tasks_not_own_parent" CHECK ("tasks"."parent_task_id" is distinct from "tasks"."id")
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_project_id_projects_organization_id_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_organization_id_actor_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","actor_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("actor_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outbox" ADD CONSTRAINT "outbox_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_labels" ADD CONSTRAINT "task_labels_organization_id_label_id_labels_organization_id_id_fk" FOREIGN KEY ("organization_id","label_id") REFERENCES "public"."labels"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_organization_id_source_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","source_task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_organization_id_target_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","target_task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_relations" ADD CONSTRAINT "task_relations_organization_id_created_by_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","created_by_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("created_by_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_project_id_projects_organization_id_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_status_id_workflow_statuses_organization_id_id_fk" FOREIGN KEY ("organization_id","status_id") REFERENCES "public"."workflow_statuses"("organization_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_assignee_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","assignee_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("assignee_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_created_by_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","created_by_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("created_by_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_parent_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","parent_task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_task_idx" ON "activity" USING btree ("organization_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX "activity_project_idx" ON "activity" USING btree ("organization_id","project_id","created_at");--> statement-breakpoint
CREATE INDEX "outbox_pending_idx" ON "outbox" USING btree ("id") WHERE "outbox"."published_at" is null;--> statement-breakpoint
CREATE INDEX "task_labels_organization_id_label_id_index" ON "task_labels" USING btree ("organization_id","label_id");--> statement-breakpoint
CREATE UNIQUE INDEX "task_relations_organization_id_source_task_id_target_task_id_type_index" ON "task_relations" USING btree ("organization_id","source_task_id","target_task_id","type");--> statement-breakpoint
CREATE INDEX "task_relations_organization_id_target_task_id_index" ON "task_relations" USING btree ("organization_id","target_task_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_organization_id_project_id_number_index" ON "tasks" USING btree ("organization_id","project_id","number");--> statement-breakpoint
CREATE INDEX "tasks_board_idx" ON "tasks" USING btree ("organization_id","project_id","status_id","rank") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_assignee_idx" ON "tasks" USING btree ("organization_id","assignee_member_id") WHERE "tasks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "tasks_parent_idx" ON "tasks" USING btree ("organization_id","parent_task_id");