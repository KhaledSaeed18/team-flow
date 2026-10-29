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
