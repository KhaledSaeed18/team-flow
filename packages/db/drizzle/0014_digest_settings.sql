CREATE TYPE "public"."digest_frequency" AS ENUM('off', 'daily', 'weekly');--> statement-breakpoint
CREATE TABLE "digest_settings" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organization_id" uuid NOT NULL,
	"member_id" uuid NOT NULL,
	"frequency" "digest_frequency" DEFAULT 'daily' NOT NULL,
	"last_sent_at" timestamp (3) with time zone,
	CONSTRAINT "digest_settings_organizationId_id_unique" UNIQUE("organization_id","id")
);
--> statement-breakpoint
ALTER TABLE "digest_settings" ADD CONSTRAINT "digest_settings_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_settings" ADD CONSTRAINT "digest_settings_organization_id_member_id_members_organization_id_id_fk" FOREIGN KEY ("organization_id","member_id") REFERENCES "public"."members"("organization_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "digest_settings_member_unique" ON "digest_settings" USING btree ("organization_id","member_id");