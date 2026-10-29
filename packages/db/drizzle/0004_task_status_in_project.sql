-- Hand-ordered: the unique key must exist before the foreign key that targets it.
ALTER TABLE "workflow_statuses" ADD CONSTRAINT "workflow_statuses_project_key" UNIQUE("organization_id","project_id","id");--> statement-breakpoint
ALTER TABLE "tasks" DROP CONSTRAINT "tasks_organization_id_status_id_workflow_statuses_organization_id_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_status_in_project_fk" FOREIGN KEY ("organization_id","project_id","status_id") REFERENCES "public"."workflow_statuses"("organization_id","project_id","id") ON DELETE no action ON UPDATE no action;
