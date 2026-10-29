-- Wake the outbox relay as soon as events are written, instead of waiting for its polling fallback.
-- Statement-level, with a constant payload: Postgres folds identical notifications in one transaction into one.
CREATE FUNCTION teamflow_outbox_wake() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('teamflow_outbox', '');
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER outbox_wake
AFTER INSERT ON outbox
FOR EACH STATEMENT EXECUTE FUNCTION teamflow_outbox_wake();
