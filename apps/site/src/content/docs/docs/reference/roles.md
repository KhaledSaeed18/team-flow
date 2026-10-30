---
title: Roles and permissions
description: What owners, admins, members and guests can do.
sidebar:
  order: 1
---

Roles are cumulative: each one can do everything the role below it can. The same permission table drives the
server, which enforces it, and the web app, which decides what to show.

| Can…                                                      | Guest | Member | Admin | Owner |
| --------------------------------------------------------- | :---: | :----: | :---: | :---: |
| Read everything in the workspace                          |   ✓   |   ✓    |   ✓   |   ✓   |
| Comment, react, keep private views, use API tokens        |   ✓   |   ✓    |   ✓   |   ✓   |
| Create and edit tasks, attach files                       |       |   ✓    |   ✓   |   ✓   |
| Create and edit projects, sprints and labels; share views |       |   ✓    |   ✓   |   ✓   |
| Edit workflows, archive and delete projects               |       |        |   ✓   |   ✓   |
| Invite people and change their roles                      |       |        |   ✓   |   ✓   |
| Remove anyone's comment or shared view                    |       |        |   ✓   |   ✓   |
| Read the audit log                                        |       |        |   ✓   |   ✓   |
| Delete the workspace                                      |       |        |       |   ✓   |

## Archived projects

Archiving a project makes it read-only for everyone, owners included. It stays readable at its address, and
admins find it under **Archived** in the sidebar. Nothing in it can change until it is restored: tasks, sprints,
labels, the workflow, comments and reactions, links, attachments and descriptions. The app shows such a project
without its editing controls, and the API answers any change with `403 FORBIDDEN` ("This project is archived.").

Completed sprints are closed in the same way for the work in them: a task can no longer join or leave a sprint once
it is completed, so its report and velocity stay as they were when it ended.
