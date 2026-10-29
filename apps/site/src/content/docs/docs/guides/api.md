---
title: The REST API
description: Personal access tokens and the OpenAPI document.
sidebar:
  order: 5
---

Everything the web app does goes through one typed contract. The same contract is published as a REST API at
`/api/v1`, documented in an OpenAPI document (`/api/openapi.json`) with an interactive reference at `/api/docs`.

## Tokens

Create a token in _Account settings → API tokens_. Give it a name, choose **read only** or **read and write**,
and pick an expiry (30 days, 90 days, a year, or never). The secret is shown once; TeamFlow stores only its hash.

```bash
curl -H "Authorization: Bearer tf_…" http://localhost:4000/api/v1/projects
```

A token:

- **acts as you**, with your role, in the workspace that was active when you made it;
- with read access, may only make `GET` requests;
- works on `/api/v1` only, not on the web app's own endpoints;
- can never create or revoke tokens, so a leaked read token cannot upgrade itself;
- stops working at once when it is revoked or expires, or when you leave the workspace.

Creating and revoking tokens is recorded in the audit log, and each token shows when it was last used.

## Examples

```bash
# Tasks in a project
curl -H "Authorization: Bearer $TOKEN" "http://localhost:4000/api/v1/projects/$PROJECT/tasks"

# Create one (needs a read and write token)
curl -X POST -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d "{\"projectId\":\"$PROJECT\",\"title\":\"Filed by a script\"}" \
  http://localhost:4000/api/v1/tasks
```
