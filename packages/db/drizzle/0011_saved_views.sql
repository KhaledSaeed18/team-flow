CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"owner_member_id" uuid NOT NULL,
	"name" text NOT NULL,
	"shared" boolean DEFAULT false NOT NULL,
	"filter" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sort" text,
	"direction" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_views_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_project_id_projects_organization_id_id_fk" FOREIGN KEY ("organization_id","project_id") REFERENCES "public"."projects"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_views" ADD CONSTRAINT "saved_views_organization_id_owner_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","owner_member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_views_name_unique" ON "saved_views" USING btree ("organization_id","project_id","owner_member_id","name");--> statement-breakpoint
CREATE INDEX "saved_views_project_idx" ON "saved_views" USING btree ("organization_id","project_id");