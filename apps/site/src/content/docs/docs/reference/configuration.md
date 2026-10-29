---
title: Configuration
description: Environment variables for the api and worker.
sidebar:
  order: 2
---

Copy `.env.example` to `.env`. Every default works with `bun run infra:up` as-is.

| Variable                                   | Used by     | Default / example                                      | What it is                                              |
| ------------------------------------------ | ----------- | ------------------------------------------------------ | ------------------------------------------------------- |
| `DATABASE_URL`                             | api, worker | `postgres://teamflow:teamflow@localhost:5442/teamflow` | PostgreSQL                                              |
| `BETTER_AUTH_SECRET`                       | api         | at least 32 characters                                 | Signs sessions. Generate with `openssl rand -base64 32` |
| `API_URL`                                  | api         | `http://localhost:4000`                                | Public URL of the api                                   |
| `WEB_URL`                                  | api, worker | `http://localhost:5173`                                | The web app, for CORS and links in email                |
| `PORT`                                     | api         | `4000`                                                 | Listening port                                          |
| `S3_ENDPOINT`                              | api         | `http://localhost:9100`                                | S3-compatible storage for attachments                   |
| `S3_REGION`, `S3_BUCKET`                   | api         | `us-east-1`, `teamflow-attachments`                    | The bucket is created on start if missing               |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | api         | `teamflow`, `teamflow-secret`                          | Storage credentials                                     |
| `SMTP_URL`                                 | worker      | `smtp://localhost:1035`                                | Mail server (Mailpit locally)                           |
| `MAIL_FROM`                                | worker      | `TeamFlow <no-reply@teamflow.local>`                   | Sender address                                          |
| `RELAY_POLL_MS`                            | worker      | `5000`                                                 | Safety-net poll for the outbox relay                    |
| `AUTH_RATE_LIMIT`                          | api         | `on`                                                   | Turn off only for end-to-end tests                      |
| `LOG_LEVEL`                                | api, worker | `info`                                                 | `trace` … `fatal`, or `silent`                          |
