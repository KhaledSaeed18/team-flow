CREATE TABLE "task_documents" (
	"organization_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	"state" "bytea" NOT NULL,
	"updated_at" timestamp (3) with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "task_documents_organization_id_task_id_pk" PRIMARY KEY("organization_id","task_id")
);
--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_organization_id_task_id_tasks_organization_id_id_fk" FOREIGN KEY ("organization_id","task_id") REFERENCES "public"."tasks"("organization_id","id") ON DELETE cascade ON UPDATE no action;