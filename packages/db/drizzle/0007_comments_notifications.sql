-- Hand edits: author and actor references use ON DELETE SET NULL (column) so removing a member keeps organization_id.
CREATE TYPE "public"."notification_kind" AS ENUM('assigned', 'mentioned', 'commented');--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"author_member_id" uuid,
	"body" text NOT NULL,
	"mentions" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"edited_at" timestamp (3) with time zone,
	"deleted_at" timestamp (3) with time zone,
	CONSTRAINT "comments_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"recipient_member_id" uuid NOT NULL,
	"actor_member_id" uuid,
	"kind" "notification_kind" NOT NULL,
	"task_id" uuid,
	"comment_id" uuid,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp (3) with time zone,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_organization_id_author_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","author_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("author_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_recipient_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","recipient_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_actor_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","actor_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE SET NULL ("actor_member_id") ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_comment_id_comments_organization_id_id_fk" FOREIGN KEY ("organization_id","comment_id") REFERENCES "public"."comments"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_task_idx" ON "comments" USING btree ("organization_id","task_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_inbox_idx" ON "notifications" USING btree ("organization_id","recipient_member_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_unread_idx" ON "notifications" USING btree ("organization_id","recipient_member_id") WHERE "notifications"."read_at" is null;