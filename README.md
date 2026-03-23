<p align="center">
  <img src="assets/images/teamflow-logo-icon.png" height="120" alt="TeamFlow Logo Icon" />
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="assets/images/teamflow-logo.png" height="120" alt="TeamFlow Logo" />
</p>

<h1 align="center">TeamFlow</h1>

<p align="center">
  A production-ready, multi-tenant Agile Workspace backend for managing organizations, projects, sprints, and tasks. built with NestJS, Prisma, and PostgreSQL.
</p>

<p align="center">
  <a href="https://github.com/KhaledSaeed18/team-flow/actions/workflows/ci.yml"><img src="https://github.com/KhaledSaeed18/team-flow/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI" /></a>
  <img src="https://img.shields.io/badge/NestJS-E0234E?logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/Prisma-2D3748?logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Docker-ready-2496ED?logo=docker&logoColor=white" alt="Docker" />
  <a href="https://team-flow-tmtz.onrender.com/api/docs"><img src="https://img.shields.io/badge/API%20Docs-Swagger-85EA2D?logo=swagger&logoColor=black" alt="API Docs" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" /></a>
</p>

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Live API Documentation](#live-api-documentation)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
  - [High-Level Architecture](#high-level-architecture)
  - [Request Lifecycle](#request-lifecycle)
  - [Multi-Tenant Data Model](#multi-tenant-data-model)
  - [Entity Relationship Diagram](#entity-relationship-diagram)
  - [Authentication Flow](#authentication-flow)
  - [Role-Based Access Control](#role-based-access-control)
  - [Notification System](#notification-system)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
  - [Auth](#auth-endpoints)
  - [Organizations](#organizations-endpoints)
  - [Memberships](#memberships-endpoints)
  - [Invitations](#invitations-endpoints)
  - [Projects](#projects-endpoints)
  - [Sprints](#sprints-endpoints)
  - [Tasks](#tasks-endpoints)
  - [Comments](#comments-endpoints)
  - [Attachments](#attachments-endpoints)
  - [Labels](#labels-endpoints)
  - [Notifications](#notifications-endpoints)
  - [Audit Logs](#audit-logs-endpoints)
- [Database Schema](#database-schema)
- [Cron Jobs](#cron-jobs)
- [Email Templates](#email-templates)
- [Security](#security)
- [Development and Deployment Workflow](#development-and-deployment-workflow)
  - [Git Branching Strategy](#git-branching-strategy)
  - [Pre-Commit Hooks](#pre-commit-hooks)
  - [Dependabot](#dependabot)
  - [CI Pipeline](#ci-pipeline)
  - [Deployment Pipeline](#deployment-pipeline)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Application](#running-the-application)
  - [Docker](#docker)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

TeamFlow is a **SaaS-style, multi-tenant Agile project management platform** designed for teams that follow agile methodologies. It provides a complete backend system where multiple organizations operate in full isolation from one another, each with their own projects, sprints, tasks, and members.

**What problem does it solve?**

Managing agile workflows across distributed teams requires robust tooling: organization-level isolation, role-based permissions, sprint planning, task tracking with dependencies, real-time notifications, and a full audit trail. TeamFlow delivers all of this as a single, self-contained backend API.

**Who is it for?**

- **Development teams** looking for an agile workspace backend they can self-host and extend
- **SaaS builders** who need a reference implementation for multi-tenant architecture with NestJS
- **Engineering leads** evaluating how to structure a production NestJS application with Prisma, JWT auth, RBAC, and audit logging

**What can you do with it?**

- Create and manage **organizations** with invite-based onboarding
- Plan work in **projects** with **sprints** and **backlogs**
- Track **tasks** with priorities, statuses, story points, subtasks, dependencies, labels, attachments, and threaded comments
- Receive **real-time notifications** via Server-Sent Events (SSE) and email
- Review a complete, immutable **audit log** of all platform activity
- Integrate with any frontend, mobile app, or third-party service through a documented REST API

---

## Key Features

| Category | Feature |
|---|---|
| **Multi-Tenancy** | Organization-based data isolation with membership scoping |
| **Authentication** | JWT access + refresh token rotation, email verification via OTP, password reset |
| **Authorization** | Four-tier role hierarchy (Owner, Admin, Member, Viewer) with guard-based enforcement |
| **Organizations** | Create, update, soft-delete, ownership transfer |
| **Invitations** | Token-based email invitations with expiry, accept/decline, and cron-based auto-expiry |
| **Projects** | CRUD, archive/restore, project keys for task identifiers |
| **Sprints** | Lifecycle management (Planned, Active, Completed), ordering |
| **Tasks** | Full lifecycle with priorities, statuses, story points, subtasks, dependencies, assignment, sprint placement |
| **Task Watching** | Users can watch tasks and receive notifications on changes |
| **Task Activity Log** | Automatic timeline of all field changes on a task |
| **Comments** | Threaded (nested) comments with edit tracking and soft-delete |
| **Attachments** | File uploads via UploadThing with metadata tracking |
| **Labels** | Organization-wide and project-scoped labels with task tagging |
| **Notifications** | Real-time SSE streaming, in-app read/unread, email alerts |
| **Audit Logging** | Immutable, decorator-driven audit trail with before/after snapshots |
| **Cron Jobs** | Automated invitation expiry, task due-soon/overdue alerts, token cleanup |
| **Email** | Transactional emails via Resend (verification, invitation, password reset, task alerts) |
| **API Documentation** | Interactive Swagger/OpenAPI docs auto-generated from decorators |
| **Rate Limiting** | Configurable throttling on all endpoints |
| **Soft Deletes** | Recoverable deletion for organizations, projects, tasks, and comments |

---

## Live API Documentation

The full interactive API documentation is available at:

**[https://team-flow-tmtz.onrender.com/api/docs](https://team-flow-tmtz.onrender.com/api/docs)**

> **Note:** This deployment uses a Render free-tier instance. The server spins down after inactivity, so the first request may take **50 seconds or more** to respond while the instance cold-starts.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Runtime** | Node.js | JavaScript runtime |
| **Language** | TypeScript (strict mode) | Type safety and developer experience |
| **Framework** | NestJS | Modular, enterprise-grade Node.js framework |
| **ORM** | Prisma with `@prisma/adapter-pg` | Type-safe database access with PostgreSQL driver adapter |
| **Database** | PostgreSQL | Primary relational data store |
| **Authentication** | `@nestjs/jwt` + bcrypt | JWT access/refresh tokens, password hashing |
| **Validation** | `class-validator` + `class-transformer` | DTO validation and transformation pipeline |
| **API Docs** | `@nestjs/swagger` (OpenAPI) | Auto-generated interactive API documentation |
| **Rate Limiting** | `@nestjs/throttler` | Configurable request throttling |
| **Scheduling** | `@nestjs/schedule` (cron) | Automated background jobs |
| **Email** | Resend SDK | Transactional email delivery |
| **File Upload** | UploadThing | Server-side file upload handling |
| **Security** | Helmet | HTTP security headers |
| **Containerization** | Docker + Docker Compose | Multi-stage builds, local PostgreSQL |
| **CI/CD** | GitHub Actions | Automated type-check, lint, and build |
| **Deployment** | Render | Cloud hosting with Docker support |
| **Package Manager** | pnpm | Fast, disk-efficient dependency management |
| **Git Hooks** | Husky | Pre-commit quality enforcement |
| **Linting** | ESLint + Prettier | Code style and formatting |

---

## Architecture

### High-Level Architecture

```mermaid
graph TB
    Client["Client Applications<br/>(Web, Mobile, CLI)"]

    subgraph "TeamFlow Backend"
        API["NestJS API Server<br/>Port 3000"]

        subgraph "Global Layer"
            Helmet["Helmet<br/>Security Headers"]
            CORS["CORS<br/>Origin Control"]
            Throttle["Throttler<br/>Rate Limiting"]
            Validation["ValidationPipe<br/>DTO Validation"]
            Transform["TransformInterceptor<br/>Response Wrapping"]
            ExFilter["GlobalExceptionFilter<br/>Error Handling"]
        end

        subgraph "Auth Layer"
            JWTGuard["JWT Auth Guard"]
            OrgGuard["Org Member Guard"]
            RolesGuard["Roles Guard"]
        end

        subgraph "Feature Modules"
            Auth["Auth Module"]
            Orgs["Organizations Module"]
            Members["Memberships Module"]
            Invites["Invitations Module"]
            Projects["Projects Module"]
            Sprints["Sprints Module"]
            Tasks["Tasks Module"]
            Comments["Comments Module"]
            Attach["Attachments Module"]
            Labels["Labels Module"]
            Notif["Notifications Module"]
            Audit["Audit Logs Module"]
            Cron["Cron Module"]
            Email["Email Module"]
        end
    end

    DB[("PostgreSQL 16")]
    Resend["Resend<br/>Email Service"]
    UploadThing["UploadThing<br/>File Storage"]

    Client -->|"HTTPS"| API
    API --> Helmet --> CORS --> Throttle --> Validation --> Transform
    Transform --> ExFilter
    ExFilter --> JWTGuard --> OrgGuard --> RolesGuard

    RolesGuard --> Auth & Orgs & Members & Invites & Projects & Sprints & Tasks & Comments & Attach & Labels & Notif & Audit

    Auth & Orgs & Members & Invites & Projects & Sprints & Tasks & Comments & Attach & Labels & Notif & Audit & Cron -->|"Prisma ORM"| DB
    Email -->|"API"| Resend
    Attach -->|"API"| UploadThing
    Cron -->|"Scheduled"| Email
    Cron -->|"Scheduled"| Notif
```

### Request Lifecycle

Every HTTP request passes through a consistent pipeline before reaching the business logic:

```mermaid
sequenceDiagram
    participant C as Client
    participant H as Helmet
    participant T as Throttler
    participant V as ValidationPipe
    participant JG as JwtAuthGuard
    participant OG as OrgMemberGuard
    participant RG as RolesGuard
    participant Ctrl as Controller
    participant Svc as Service
    participant AI as AuditLogInterceptor
    participant TI as TransformInterceptor
    participant EF as GlobalExceptionFilter

    C->>H: HTTP Request
    H->>T: Security headers applied
    T->>V: Rate limit check passed
    V->>JG: DTO validated & transformed

    alt Public route (@Public)
        JG->>Ctrl: Skip auth
    else Protected route
        JG->>JG: Verify JWT from Bearer token
        JG->>OG: Attach user to request
        OG->>OG: Verify org membership via params
        OG->>RG: Attach membership to request
        RG->>RG: Check role hierarchy (OWNER > ADMIN > MEMBER > VIEWER)
        RG->>Ctrl: Access granted
    end

    Ctrl->>Svc: Delegate to service layer
    Svc-->>Ctrl: Return result
    Ctrl-->>AI: Response data
    AI->>AI: Write audit log (fire-and-forget)
    AI-->>TI: Pass response
    TI-->>C: Wrap in { data, meta: { timestamp } }

    Note over EF: Catches any unhandled exception<br/>Returns structured error response
```

### Multi-Tenant Data Model

TeamFlow enforces organization-level isolation. Every piece of data belongs to an organization, and access is verified through membership at the guard level.

```mermaid
graph TD
    User["User"]

    User -->|"owns"| Org["Organization"]
    User -->|"member of"| Membership["Membership<br/>(OWNER | ADMIN | MEMBER | VIEWER)"]
    Membership --> Org

    Org -->|"contains"| Project["Project"]
    Org -->|"contains"| Label["Label (org-wide)"]
    Org -->|"tracks"| AuditLog["Audit Log"]
    Org -->|"sends"| Invitation["Invitation"]

    Project -->|"contains"| Sprint["Sprint"]
    Project -->|"contains"| Task["Task"]
    Project -->|"scopes"| PLabel["Label (project-scoped)"]

    Sprint -->|"holds"| Task

    Task -->|"has"| Comment["Comment"]
    Task -->|"has"| Attachment["Attachment"]
    Task -->|"tagged with"| TaskLabel["TaskLabel"]
    Task -->|"blocks / blocked by"| TaskDep["TaskDependency"]
    Task -->|"watched by"| TaskWatcher["TaskWatcher"]
    Task -->|"logged in"| TaskActivity["TaskActivity"]
    Task -->|"subtask of"| Task
```

### Entity Relationship Diagram

<p align="center">
  <img src="assets/images/team-flow-erd.png" alt="TeamFlow Entity Relationship Diagram" />
</p>

<p align="center">
  <a href="https://dbdiagram.io/d/team-flow-69a76b60a3f0aa31e1b72609">View interactive ERD on dbdiagram.io</a>
</p>

### Authentication Flow

TeamFlow uses a stateless JWT access token paired with a rotating refresh token stored in the database. Email verification is enforced via OTP codes.

```mermaid
sequenceDiagram
    participant C as Client
    participant A as Auth API
    participant DB as Database
    participant E as Email (Resend)

    Note over C,E: Registration Flow
    C->>A: POST /api/auth/register {email, password, name}
    A->>DB: Create user (emailVerified=false)
    A->>DB: Create OTP code (hashed, 15min TTL)
    A->>E: Send verification email with 6-digit code
    A-->>C: 201 { message: "Verify your email" }

    C->>A: POST /api/auth/verify-email {email, code}
    A->>DB: Verify OTP hash, mark used
    A->>DB: Set emailVerified=true
    A-->>C: 200 { message: "Email verified" }

    Note over C,E: Login Flow
    C->>A: POST /api/auth/login {email, password}
    A->>DB: Validate credentials + emailVerified
    A->>DB: Create refresh token (hashed, 7d TTL)
    A-->>C: 200 { accessToken (15m), refreshToken (7d), user }

    Note over C,E: Token Refresh
    C->>A: POST /api/auth/refresh {refreshToken}
    A->>DB: Validate token hash, check not revoked/expired
    A->>DB: Revoke old token, create new token pair
    A-->>C: 200 { accessToken, refreshToken }

    Note over C,E: Password Reset
    C->>A: POST /api/auth/forgot-password {email}
    A->>DB: Create OTP code (hashed, 15min TTL)
    A->>E: Send password reset OTP email
    C->>A: POST /api/auth/reset-password {email, code, newPassword}
    A->>DB: Verify OTP, update password hash
    A->>DB: Revoke all refresh tokens for user
    A-->>C: 200 { message: "Password reset successful" }
```

### Role-Based Access Control

The role system uses a strict hierarchy. Higher roles inherit all permissions of lower roles. The `RolesGuard` enforces minimum role requirements on each endpoint.

```mermaid
graph LR
    VIEWER["VIEWER<br/>Read-only access"]
    MEMBER["MEMBER<br/>Create & manage own work"]
    ADMIN["ADMIN<br/>Manage projects, sprints,<br/>members, labels, invitations"]
    OWNER["OWNER<br/>Full control including<br/>delete org & transfer ownership"]

    VIEWER -->|"inherits"| MEMBER -->|"inherits"| ADMIN -->|"inherits"| OWNER

    SA["SUPER_ADMIN<br/>(Global Role)"]
    SA -.->|"bypasses all<br/>role & membership checks"| OWNER
```

| Role | Permissions |
|---|---|
| **VIEWER** | View organizations, projects, sprints, tasks, comments, labels, attachments |
| **MEMBER** | All Viewer permissions + create tasks, comments, attachments; watch tasks; manage own work |
| **ADMIN** | All Member permissions + manage projects, sprints, labels, members, invitations; view audit logs |
| **OWNER** | All Admin permissions + delete organization, transfer ownership |
| **SUPER_ADMIN** | Global role that bypasses all membership and role checks across every organization |

### Notification System

TeamFlow provides both real-time push notifications via SSE and email alerts for critical events.

```mermaid
graph LR
    subgraph "Triggers"
        T1["Task Assigned"]
        T2["Task Status Changed"]
        T3["Task Commented"]
        T4["Task Due Soon (cron)"]
        T5["Task Overdue (cron)"]
        T6["Sprint Started/Completed"]
        T7["Member Joined/Removed"]
        T8["Mention in Comment"]
    end

    subgraph "Notification Service"
        NS["NotificationsService<br/>createAndEmit()"]
    end

    subgraph "Delivery"
        DB["Database<br/>(persist notification)"]
        SSE["SSE Stream<br/>/api/notifications/stream"]
        Email["Resend Email<br/>(for assignees)"]
    end

    T1 & T2 & T3 & T4 & T5 & T6 & T7 & T8 --> NS
    NS --> DB
    NS --> SSE
    NS --> Email
```

---

## Project Structure

```
team-flow/
├── .github/
│   ├── workflows/
│   │   └── ci.yml                      # GitHub Actions CI pipeline
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   └── PULL_REQUEST_TEMPLATE.md
├── assets/images/                       # Logos and ERD diagram
├── prisma/
│   ├── schema.prisma                    # Database schema (17 models, 12 enums)
│   └── migrations/                      # Prisma migration history
├── scripts/
│   └── test-resend.ts                   # Resend integration test script
├── src/
│   ├── main.ts                          # Application bootstrap
│   ├── app.module.ts                    # Root module
│   ├── app.controller.ts               # Health check endpoint
│   ├── app.service.ts
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── audit-log.decorator.ts   # @AuditLog() decorator
│   │   │   ├── current-user.decorator.ts# @CurrentUser() param decorator
│   │   │   ├── org-id.decorator.ts      # @OrgId() param decorator
│   │   │   ├── public.decorator.ts      # @Public() route decorator
│   │   │   └── roles.decorator.ts       # @Roles() route decorator
│   │   ├── filters/
│   │   │   └── global-exception.filter.ts  # Structured error responses
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts        # JWT Bearer token verification
│   │   │   ├── org-member.guard.ts      # Organization membership check
│   │   │   └── roles.guard.ts           # Role hierarchy enforcement
│   │   ├── interceptors/
│   │   │   ├── audit-log.interceptor.ts # Before/after snapshot audit logging
│   │   │   └── transform.interceptor.ts # Response wrapping { data, meta }
│   │   ├── interfaces/
│   │   │   └── jwt-payload.interface.ts # JWT token payload type
│   │   └── utils/
│   │       └── otp.util.ts             # OTP generation and HTML escaping
│   ├── config/
│   │   ├── app.config.ts               # App name, port, CORS, environment
│   │   ├── database.config.ts          # DATABASE_URL
│   │   ├── jwt.config.ts               # JWT secrets and expiration
│   │   ├── resend.config.ts            # Resend API key, from address
│   │   ├── throttler.config.ts         # Rate limiter TTL and limit
│   │   └── env.ts                      # requireEnv / optionalEnv helpers
│   ├── database/
│   │   ├── prisma.module.ts            # Global Prisma module
│   │   └── prisma.service.ts           # PrismaClient with pg adapter, logging
│   ├── generated/prisma/               # Auto-generated Prisma client
│   └── modules/
│       ├── auth/                        # Registration, login, JWT, OTP, profile
│       ├── organizations/               # Org CRUD, ownership transfer
│       ├── memberships/                 # Member listing, role changes, removal
│       ├── invitations/                 # Invite send, accept, decline, revoke
│       ├── projects/                    # Project CRUD, archive, restore
│       ├── sprints/                     # Sprint CRUD, start, complete
│       ├── tasks/                       # Task CRUD, assign, move, watch, dependencies
│       ├── comments/                    # Threaded comments CRUD
│       ├── attachments/                 # File upload metadata, UploadThing router
│       ├── labels/                      # Org/project labels, task tagging
│       ├── notifications/               # SSE stream, read/unread, CRUD
│       ├── audit-logs/                  # Immutable audit log queries
│       ├── cron/                        # Scheduled background jobs
│       │   └── jobs/
│       │       ├── invitation-expiry.service.ts
│       │       ├── task-due-soon.service.ts
│       │       ├── task-overdue.service.ts
│       │       └── token-cleanup.service.ts
│       ├── email/                       # Resend email service + templates
│       └── users/                       # User lookup service
├── test/
│   └── jest-e2e.json                    # E2E test configuration
├── docker-compose.yml                   # Local PostgreSQL service
├── Dockerfile                           # Multi-stage production build
├── nest-cli.json
├── tsconfig.json
├── tsconfig.build.json
├── eslint.config.mjs
├── prisma.config.ts
├── package.json
└── pnpm-workspace.yaml
```

Each feature module follows a consistent structure:

```
modules/<feature>/
├── <feature>.controller.ts     # Route definitions, Swagger decorators, guards
├── <feature>.module.ts         # NestJS module declaration
├── <feature>.service.ts        # Business logic, Prisma queries
├── dto/                        # Request validation DTOs (class-validator)
│   ├── create-<feature>.dto.ts
│   └── update-<feature>.dto.ts
└── entities/                   # Response shape definitions (Swagger)
    └── <feature>.entity.ts
```

---

## API Reference

All endpoints are prefixed with `/api`. Protected endpoints require a `Bearer` token in the `Authorization` header.

### Auth Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `POST` | `/api/auth/register` | Create a new user account | Public |
| `POST` | `/api/auth/verify-email` | Verify email with OTP code | Public |
| `POST` | `/api/auth/resend-verification` | Resend email verification OTP | Public |
| `POST` | `/api/auth/forgot-password` | Request password reset OTP | Public |
| `POST` | `/api/auth/reset-password` | Reset password using OTP | Public |
| `POST` | `/api/auth/login` | Login with email and password | Public |
| `POST` | `/api/auth/refresh` | Rotate refresh token and get new tokens | Public |
| `POST` | `/api/auth/logout` | Revoke refresh token | JWT |
| `GET` | `/api/auth/me` | Get current user profile | JWT |
| `PATCH` | `/api/auth/me` | Update current user profile | JWT |
| `PATCH` | `/api/auth/me/password` | Change password | JWT |

### Organizations Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `POST` | `/api/organizations` | Create a new organization | JWT |
| `GET` | `/api/organizations` | List current user's organizations | JWT |
| `GET` | `/api/organizations/:id` | Get organization by ID | MEMBER |
| `PATCH` | `/api/organizations/:id` | Update organization | ADMIN |
| `DELETE` | `/api/organizations/:id` | Soft delete organization | OWNER |
| `PATCH` | `/api/organizations/:id/transfer` | Transfer ownership | OWNER |

### Memberships Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/organizations/:orgId/members` | List organization members | MEMBER |
| `PATCH` | `/api/organizations/:orgId/members/:userId` | Change a member's role | ADMIN |
| `DELETE` | `/api/organizations/:orgId/members/:userId` | Remove a member | ADMIN |
| `DELETE` | `/api/organizations/:orgId/members/me` | Leave the organization | MEMBER |

### Invitations Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `POST` | `/api/organizations/:orgId/invitations` | Send an invitation | ADMIN |
| `GET` | `/api/organizations/:orgId/invitations` | List organization invitations | ADMIN |
| `DELETE` | `/api/organizations/:orgId/invitations/:id` | Revoke a pending invitation | ADMIN |
| `GET` | `/api/invitations/:token` | Get invitation info by token | Public |
| `POST` | `/api/invitations/:token/accept` | Accept an invitation | JWT |
| `POST` | `/api/invitations/:token/decline` | Decline an invitation | JWT |

### Projects Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/organizations/:orgId/projects` | List all projects | MEMBER |
| `POST` | `/api/organizations/:orgId/projects` | Create a new project | ADMIN |
| `GET` | `/api/organizations/:orgId/projects/:id` | Get project by ID | MEMBER |
| `PATCH` | `/api/organizations/:orgId/projects/:id` | Update project | ADMIN |
| `POST` | `/api/organizations/:orgId/projects/:id/archive` | Archive project | ADMIN |
| `DELETE` | `/api/organizations/:orgId/projects/:id` | Soft delete project | ADMIN |
| `POST` | `/api/organizations/:orgId/projects/:id/restore` | Restore soft-deleted project | ADMIN |

### Sprints Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/projects/:projectId/sprints` | List all sprints in a project | MEMBER |
| `POST` | `/api/projects/:projectId/sprints` | Create a new sprint | ADMIN |
| `GET` | `/api/projects/:projectId/sprints/:id` | Get sprint by ID | MEMBER |
| `PATCH` | `/api/projects/:projectId/sprints/:id` | Update sprint details | ADMIN |
| `POST` | `/api/projects/:projectId/sprints/:id/start` | Start a sprint | ADMIN |
| `POST` | `/api/projects/:projectId/sprints/:id/complete` | Complete a sprint | ADMIN |
| `DELETE` | `/api/projects/:projectId/sprints/:id` | Delete a sprint | ADMIN |

### Tasks Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `POST` | `/api/projects/:projectId/tasks` | Create a new task | MEMBER |
| `GET` | `/api/projects/:projectId/tasks` | List tasks with filters and pagination | MEMBER |
| `GET` | `/api/projects/:projectId/tasks/backlog` | Get backlog tasks (no sprint) | MEMBER |
| `GET` | `/api/projects/:projectId/tasks/:taskId` | Get task details | MEMBER |
| `PATCH` | `/api/projects/:projectId/tasks/:taskId` | Update a task | MEMBER |
| `DELETE` | `/api/projects/:projectId/tasks/:taskId` | Soft-delete a task | MEMBER |
| `PATCH` | `/api/projects/:projectId/tasks/:taskId/restore` | Restore a soft-deleted task | ADMIN |
| `PATCH` | `/api/projects/:projectId/tasks/:taskId/assign` | Assign or unassign a task | MEMBER |
| `PATCH` | `/api/projects/:projectId/tasks/:taskId/move` | Move task to sprint or backlog | MEMBER |
| `POST` | `/api/projects/:projectId/tasks/:taskId/watch` | Watch a task | MEMBER |
| `DELETE` | `/api/projects/:projectId/tasks/:taskId/watch` | Unwatch a task | MEMBER |
| `POST` | `/api/projects/:projectId/tasks/:taskId/dependencies` | Add a dependency | MEMBER |
| `DELETE` | `/api/projects/:projectId/tasks/:taskId/dependencies/:depId` | Remove a dependency | MEMBER |
| `GET` | `/api/projects/:projectId/tasks/:taskId/activities` | Get task activity log | MEMBER |

### Comments Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/tasks/:taskId/comments` | List threaded comments for a task | MEMBER |
| `POST` | `/api/tasks/:taskId/comments` | Add a comment to a task | MEMBER |
| `PATCH` | `/api/tasks/:taskId/comments/:id` | Edit a comment (author only) | MEMBER |
| `DELETE` | `/api/tasks/:taskId/comments/:id` | Soft-delete a comment (author or Admin) | MEMBER |

### Attachments Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/tasks/:taskId/attachments` | List attachments for a task | MEMBER |
| `POST` | `/api/tasks/:taskId/attachments` | Save attachment metadata | MEMBER |
| `DELETE` | `/api/tasks/:taskId/attachments/:id` | Remove an attachment | MEMBER |

### Labels Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/organizations/:orgId/labels` | List org-wide labels | MEMBER |
| `POST` | `/api/organizations/:orgId/labels` | Create an org-wide label | ADMIN |
| `GET` | `/api/projects/:projectId/labels` | List project-scoped labels | MEMBER |
| `POST` | `/api/projects/:projectId/labels` | Create a project-scoped label | ADMIN |
| `PATCH` | `/api/labels/:id` | Update a label | ADMIN |
| `DELETE` | `/api/labels/:id` | Delete a label | ADMIN |
| `POST` | `/api/tasks/:taskId/labels/:labelId` | Tag a task with a label | MEMBER |
| `DELETE` | `/api/tasks/:taskId/labels/:labelId` | Remove a label from a task | MEMBER |

### Notifications Endpoints

| Method | Endpoint | Description | Auth |
|---|---|---|---|
| `GET` | `/api/notifications` | List notifications (paginated) | JWT |
| `GET` | `/api/notifications/unread-count` | Get unread notification count | JWT |
| `GET` | `/api/notifications/stream` | Subscribe to real-time SSE stream | JWT |
| `PATCH` | `/api/notifications/read-all` | Mark all notifications as read | JWT |
| `PATCH` | `/api/notifications/:id/read` | Mark a single notification as read | JWT |
| `DELETE` | `/api/notifications/:id` | Delete a notification | JWT |

### Audit Logs Endpoints

| Method | Endpoint | Description | Min Role |
|---|---|---|---|
| `GET` | `/api/organizations/:orgId/audit-logs` | List audit logs for an organization | ADMIN |

---

## Database Schema

The database contains **17 models** and **12 enums** managed through Prisma migrations on PostgreSQL.

**Models:** User, OtpCode, RefreshToken, Organization, Membership, Invitation, Project, Sprint, Task, TaskDependency, TaskWatcher, TaskActivity, Comment, Attachment, Label, TaskLabel, Notification, AuditLog

**Enums:**

| Enum | Values |
|---|---|
| `GlobalRole` | SUPER_ADMIN, USER |
| `MembershipRole` | OWNER, ADMIN, MEMBER, VIEWER |
| `ProjectStatus` | ACTIVE, ARCHIVED |
| `SprintStatus` | PLANNED, ACTIVE, COMPLETED |
| `TaskPriority` | LOW, MEDIUM, HIGH, CRITICAL |
| `TaskStatus` | TODO, IN_PROGRESS, IN_REVIEW, DONE, CANCELLED |
| `InvitationStatus` | PENDING, ACCEPTED, DECLINED, EXPIRED, REVOKED |
| `NotificationType` | TASK_ASSIGNED, TASK_UPDATED, TASK_COMMENTED, TASK_STATUS_CHANGED, TASK_DUE_SOON, TASK_OVERDUE, SPRINT_STARTED, SPRINT_COMPLETED, PROJECT_ARCHIVED, MEMBER_JOINED, MEMBER_REMOVED, MENTION |
| `AuditAction` | CREATE, UPDATE, DELETE, RESTORE, ARCHIVE, INVITE, JOIN, LEAVE, ASSIGN, UNASSIGN |
| `AttachmentSource` | UPLOAD, GOOGLE_DRIVE, DROPBOX, URL |
| `CommentType` | TEXT, SYSTEM |
| `OtpPurpose` | EMAIL_VERIFICATION, PASSWORD_RESET |

Key design decisions:
- **Soft deletes** on User, Organization, Project, Task, and Comment via `deletedAt` timestamps
- **Composite unique constraints** for multi-tenant isolation (e.g., `[userId, organizationId]` on Membership)
- **Auto-incrementing task numbers** per project for human-readable identifiers like `PROJ-42`
- **Self-referencing relations** for subtasks (Task) and threaded replies (Comment)
- **JSON fields** for flexible org settings and audit log metadata
- **Comprehensive indexing** on foreign keys, status fields, and frequently queried columns

---

## Cron Jobs

Four scheduled background jobs run automatically to maintain system health and send timely alerts:

| Job | Schedule | Purpose |
|---|---|---|
| **Invitation Expiry** | Every hour | Marks `PENDING` invitations as `EXPIRED` when `expiresAt` has passed |
| **Task Due Soon** | Every 6 hours | Notifies watchers (SSE) and emails assignees about tasks due within 24 hours |
| **Task Overdue** | Daily at 8:00 AM | Notifies watchers (SSE) and emails assignees about past-due tasks |
| **Token Cleanup** | Daily at 2:00 AM | Deletes expired and revoked refresh tokens from the database |

---

## Email Templates

TeamFlow sends transactional emails via [Resend](https://resend.com) with branded HTML templates:

| Template | Trigger | Recipient |
|---|---|---|
| **Email Verification** | User registration | New user |
| **Password Reset OTP** | Forgot password request | User |
| **Invitation** | Admin invites a user to an organization | Invitee |
| **Welcome** | User accepts an invitation | New member |
| **Task Assigned** | Task is assigned to a user | Assignee |
| **Task Due Soon** | Cron detects task due within 24h | Assignee |
| **Task Overdue** | Cron detects past-due task | Assignee |
| **Password Reset** | Legacy reset link (URL-based) | User |

All templates use a consistent layout with the TeamFlow branding header, responsive design, and XSS-safe HTML escaping.

---

## Security

TeamFlow implements multiple layers of security:

| Mechanism | Implementation |
|---|---|
| **Authentication** | JWT access tokens (15min) + rotating refresh tokens (7d) with bcrypt-hashed storage |
| **Password Hashing** | bcrypt with automatic salt generation |
| **OTP Codes** | bcrypt-hashed, time-limited, attempt-tracked one-time passwords |
| **HTTP Security** | Helmet middleware for security headers (CSP, HSTS, X-Frame-Options, etc.) |
| **CORS** | Configurable origin allowlist |
| **Rate Limiting** | Global throttle guard (default: 10 requests per 60 seconds), stricter limits on auth endpoints |
| **Input Validation** | Whitelist-only DTO validation via `class-validator` with `forbidNonWhitelisted` |
| **SQL Injection** | Prevented by Prisma's parameterized queries |
| **XSS Prevention** | HTML escaping on all email template dynamic content |
| **Soft Deletes** | Data recovery without permanent loss |
| **Audit Trail** | Immutable audit logs with before/after snapshots, IP address, and user agent |
| **Sensitive Data** | Password, token, and refreshToken fields are redacted from audit log snapshots |
| **Token Revocation** | Refresh tokens can be revoked on logout; all tokens revoked on password reset |
| **Email Verification** | Required before login is allowed |

---

## Development and Deployment Workflow

TeamFlow follows a structured development workflow from local development through CI checks to production deployment.

### Git Branching Strategy

```mermaid
gitGraph
    commit id: "initial"
    branch dev
    checkout dev
    commit id: "feat: task module"
    branch feat/task-dependencies
    commit id: "add dependency model"
    commit id: "add dependency endpoints"
    checkout dev
    merge feat/task-dependencies id: "PR #12 merged" tag: "squash"
    branch fix/token-expiry
    commit id: "fix refresh token edge case"
    checkout dev
    merge fix/token-expiry id: "PR #13 merged" tag: "squash"
    checkout main
    merge dev id: "Release v1.2" tag: "v1.2"
```

**Branch naming conventions:**

| Prefix | Usage |
|---|---|
| `feat/` | New feature |
| `fix/` | Bug fix |
| `chore/` | Maintenance, dependencies, config |
| `docs/` | Documentation only |
| `refactor/` | Code restructuring |
| `test/` | Adding or updating tests |

**Branch protection rules on `main` and `dev`:**
- Pull request required (no direct pushes)
- Status checks must pass (CI pipeline)
- Squash merge enforced

### Pre-Commit Hooks

Husky runs automated checks before every commit:

```mermaid
graph LR
    GC["git commit"] --> H["Husky Pre-Commit Hook"]
    H --> TC["TypeScript Type Check<br/>pnpm type-check"]
    TC -->|pass| FMT["Code Formatting Check<br/>pnpm format --check"]
    FMT -->|pass| LINT["ESLint<br/>pnpm lint"]
    LINT -->|pass| OK["Commit Accepted"]

    TC -->|fail| BLOCK["Commit Blocked"]
    FMT -->|fail| BLOCK
    LINT -->|fail| BLOCK
```

### Dependabot

Dependabot keeps dependencies and GitHub Actions versions current with scheduled update PRs and security alerts.

Current configuration in `.github/dependabot.yml`:

| Ecosystem | Scope | Schedule | Notes |
|---|---|---|---|
| `npm` | Root workspace (`/`) | Weekly (Monday, 04:00 UTC) | Target branch: `dev`; auto-rebase; labels (`dependencies`, `security`); commit prefix `chore(deps)` with scope; grouped updates for `@nestjs/*`, `prisma`, `@prisma/*` |
| `github-actions` | Repository workflows | Monthly (Monday, 05:00 UTC) | Target branch: `dev`; auto-rebase; labels (`dependencies`, `github-actions`); commit prefix `chore(ci)` with scope |

**Branch strategy:**
- Dependabot PRs target `dev` first.
- Changes are promoted to `main` through normal `dev -> main` release PR flow.

**PR conventions:**
- Dependabot rebases update PRs automatically when needed.
- Commit messages follow conventional prefixes for cleaner history and release notes.

**How TeamFlow handles transitive security advisories:**
- If Dependabot cannot auto-open a fix PR for a transitive package, we pin a patched transitive version using `pnpm.overrides` in `package.json`.
- After updating overrides, regenerate and commit `pnpm-lock.yaml` so GitHub dependency scanning can resolve the fixed version.
- Remove temporary overrides once upstream packages adopt patched versions.

### CI Pipeline

GitHub Actions runs on every push to `dev` and on pull requests targeting `main` or `dev`:

```mermaid
graph TD
    PR["Pull Request / Push to dev"] --> CI["GitHub Actions CI"]

    CI --> CHECKOUT["Checkout Code"]
    CHECKOUT --> NODE["Setup Node.js 22"]
    NODE --> PNPM["Install pnpm"]
    PNPM --> CACHE["Cache pnpm dependencies"]
    CACHE --> INSTALL["pnpm install --frozen-lockfile"]
    INSTALL --> GENERATE["prisma generate"]
    GENERATE --> TYPECHECK["TypeScript type check"]
    TYPECHECK --> LINT["ESLint"]
    LINT --> BUILD["Build"]
    BUILD -->|all pass| STATUS["Status Check: Pass"]
    BUILD -->|any fail| FAIL["Status Check: Fail"]

    STATUS --> MERGE["PR can be merged"]
    FAIL --> BLOCKED["PR merge blocked"]
```

### Deployment Pipeline

```mermaid
graph TD
    DEV["Developer pushes to feature branch"]
    DEV --> PR["Opens PR to dev"]
    PR --> CI["CI Pipeline Runs<br/>(type-check, lint, build)"]
    CI -->|pass| REVIEW["Code Review"]
    REVIEW --> MERGE_DEV["Merge to dev"]

    MERGE_DEV --> CI2["CI Runs on dev"]
    CI2 -->|pass| PR_MAIN["Open PR: dev → main"]

    PR_MAIN --> CI3["CI Pipeline Runs on PR"]
    CI3 -->|pass| MERGE_MAIN["Merge to main"]

    MERGE_MAIN --> RENDER["Render Deployment<br/>(Manual trigger after CI passes)"]

    subgraph "Render Build"
        RENDER --> DOCKER["Docker Multi-Stage Build"]
        DOCKER --> DEPS["Stage 1: Install dependencies<br/>pnpm install --frozen-lockfile"]
        DEPS --> BUILD["Stage 2: Build<br/>prisma generate + pnpm build"]
        BUILD --> PROD["Stage 3: Production image<br/>Alpine Node.js, minimal footprint"]
        PROD --> MIGRATE["Run prisma migrate deploy"]
        MIGRATE --> START["Start server<br/>node dist/src/main"]
    end
```

**Docker multi-stage build details:**

| Stage | Purpose | Base Image |
|---|---|---|
| **deps** | Install production dependencies | `node:22-alpine` |
| **builder** | Generate Prisma client and compile TypeScript | `node:22-alpine` |
| **runner** | Minimal production image with compiled app | `node:22-alpine` |

The production container includes a health check endpoint (`GET /api`) and exposes port 3000.

---

## Getting Started

### Prerequisites

- **Node.js** >= 22
- **pnpm** (latest)
- **PostgreSQL** 16 (or use Docker)
- **Resend** API key (for email features)
- **UploadThing** token (for file uploads)

### Installation

```bash
# Clone the repository
git clone https://github.com/KhaledSaeed18/team-flow.git
cd team-flow

# Install dependencies
pnpm install
```

### Environment Variables

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

| Variable | Required | Description |
|---|---|---|
| `APP_NAME` | No | Application name (default: `team-flow`) |
| `PORT` | No | Server port (default: `3000`) |
| `NODE_ENV` | No | Environment: `development`, `production`, `test` |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `JWT_SECRET` | Yes | Secret key for signing access tokens |
| `JWT_REFRESH_SECRET` | Yes | Secret key for signing refresh tokens |
| `JWT_ACCESS_EXPIRES_IN` | No | Access token TTL (default: `15m`) |
| `JWT_REFRESH_EXPIRES_IN` | No | Refresh token TTL (default: `7d`) |
| `THROTTLE_TTL` | No | Rate limit window in seconds (default: `60`) |
| `THROTTLE_LIMIT` | No | Max requests per window (default: `10`) |
| `UPLOADTHING_TOKEN` | Yes | UploadThing API token |
| `RESEND_API_KEY` | Yes | Resend email service API key |
| `RESEND_FROM_EMAIL` | No | Sender email address |
| `RESEND_FROM_NAME` | No | Sender display name (default: `TeamFlow`) |
| `CORS_ORIGINS` | No | Comma-separated allowed origins |

### Running the Application

**Using Docker Compose (recommended for PostgreSQL):**

```bash
# Start PostgreSQL
docker compose up -d

# Set DATABASE_URL in .env:
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/team-flow
```

**Run database migrations:**

```bash
pnpm prisma:migrate
```

**Start the development server:**

```bash
pnpm start:dev
```

The API will be available at `http://localhost:3000/api` and Swagger docs at `http://localhost:3000/api/docs`.

**Available scripts:**

| Script | Description |
|---|---|
| `pnpm start:dev` | Start in watch mode |
| `pnpm start:debug` | Start in debug + watch mode |
| `pnpm build` | Compile TypeScript |
| `pnpm start:prod` | Run compiled production build |
| `pnpm lint` | Run ESLint with auto-fix |
| `pnpm format` | Format code with Prettier |
| `pnpm type-check` | TypeScript type validation (no emit) |
| `pnpm test` | Run unit tests |
| `pnpm test:e2e` | Run end-to-end tests |
| `pnpm prisma:generate` | Regenerate Prisma client |
| `pnpm prisma:migrate` | Create and apply a new migration |
| `pnpm prisma:migrate:deploy` | Apply pending migrations (production) |
| `pnpm prisma:migrate:reset` | Reset database and re-apply migrations |
| `pnpm prisma:studio` | Open Prisma Studio GUI |

### Docker

**Build and run the production Docker image:**

```bash
docker build -t teamflow .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://user:pass@host:5432/db" \
  -e JWT_SECRET="your-secret" \
  -e JWT_REFRESH_SECRET="your-refresh-secret" \
  -e RESEND_API_KEY="your-resend-key" \
  -e UPLOADTHING_TOKEN="your-uploadthing-token" \
  teamflow
```

The container automatically runs `prisma migrate deploy` before starting the server.

---

## Contributing

Contributions are welcome. Please read the [Contributing Guide](CONTRIBUTING.md) before submitting a pull request.

**Quick links:**
- [Contributing Guide](CONTRIBUTING.md)
- [Code of Conduct](CODE_OF_CONDUCT.md)
- [Security Policy](SECURITY.md)
- [Pull Request Template](.github/PULL_REQUEST_TEMPLATE.md)
- [Bug Report Template](.github/ISSUE_TEMPLATE/bug_report.md)
- [Feature Request Template](.github/ISSUE_TEMPLATE/feature_request.md)

**Repository:** [https://github.com/KhaledSaeed18/team-flow](https://github.com/KhaledSaeed18/team-flow)

---

## License

This project is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 Khaled Saeed
