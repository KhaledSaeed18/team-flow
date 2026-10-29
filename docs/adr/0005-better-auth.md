# 0005 — Better Auth for identity, sessions and organizations

- Status: Accepted
- Date: 2026-10-29

## Context

v1 hand-rolled JWT access/refresh tokens, OTP verification and password reset. That is a lot of security-sensitive
code to own for no product differentiation.

## Decision

Use **Better Auth** with the Drizzle adapter, mounted on Hono at `/api/auth/*`:

- Email + password with email OTP verification and password reset; GitHub OAuth.
- Database sessions in an HTTP-only, `SameSite=Lax` cookie (no tokens in JavaScript), with session list/revoke.
- The organization plugin for organizations, members, invitations and teams, with a custom access-control
  definition (`owner`, `admin`, `member`, `guest`) declared in `packages/auth` and shared with the web app so the UI
  can ask "can I?" with the same statements the server enforces.
- The API-key plugin backs personal access tokens for the public API.

## Consequences

- Auth tables follow Better Auth's shape; our own tables reference `user.id` and `member.id`.
- Authorization of product resources (tasks, projects) stays ours, in services, using the same role statements.
