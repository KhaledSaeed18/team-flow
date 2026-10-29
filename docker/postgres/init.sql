-- Runs once, on first start of an empty volume.
-- A separate database for integration tests so `bun test` never touches dev data.
CREATE DATABASE teamflow_test OWNER teamflow;

\connect teamflow
CREATE EXTENSION IF NOT EXISTS pg_trgm;

\connect teamflow_test
CREATE EXTENSION IF NOT EXISTS pg_trgm;
