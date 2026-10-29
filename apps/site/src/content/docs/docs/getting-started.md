---
title: Getting started
description: Run TeamFlow locally with a seeded demo workspace.
---

You need [Bun](https://bun.sh) 1.4 or later and Docker.

## Run it

```bash
git clone https://github.com/KhaledSaeed18/team-flow.git
cd team-flow
cp .env.example .env
bun install
bun run infra:up     # PostgreSQL, S3-compatible storage (RustFS) and Mailpit
bun run db:migrate
bun run db:seed      # the Northwind Robotics demo workspace
bun run dev          # api, worker, web app and this site
```

Then open [localhost:5173](http://localhost:5173) and sign in as **demo@teamflow.dev** with password
**teamflow-demo**. Other people in the demo, such as `maya@northwind.test`, use the same password. Sign in as
two of them in two browsers to see live updates and shared editing.

| Service             | Address                                                              |
| ------------------- | -------------------------------------------------------------------- |
| Web app             | [localhost:5173](http://localhost:5173)                              |
| API reference       | [localhost:4000/api/docs](http://localhost:4000/api/docs)            |
| This site           | [localhost:4321](http://localhost:4321)                              |
| Mailpit (all email) | [localhost:8035](http://localhost:8035)                              |
| Storage console     | [localhost:9101](http://localhost:9101) (teamflow / teamflow-secret) |

## Check it

```bash
bun run check                                # lint, typecheck and every test
bun run --cwd apps/web test:e2e              # Playwright, against a fresh seeded stack
```

Integration tests run against real PostgreSQL: each test file gets its own database, cloned from a migrated
template in milliseconds.
