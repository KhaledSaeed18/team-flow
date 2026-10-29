import { relations } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { newId } from '../ids.ts';

/**
 * Tables owned by Better Auth (ADR-0005). Their shape follows what Better Auth reads and writes; we only choose
 * types (uuid, timestamptz), names and extra constraints. Product tables reference people by `members.id` through
 * a composite `(organization_id, id)` key, never by `users.id`.
 */

const id = () => uuid().primaryKey().$defaultFn(newId);
const createdAt = () => timestamp({ withTimezone: true, precision: 3 }).notNull().defaultNow();
const updatedAt = () =>
  timestamp({ withTimezone: true, precision: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const at = () => timestamp({ withTimezone: true, precision: 3 });

export const users = pgTable('users', {
  id: id(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: id(),
    token: text().notNull().unique(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: at().notNull(),
    ipAddress: text(),
    userAgent: text(),
    activeOrganizationId: uuid().references(() => organizations.id, { onDelete: 'set null' }),
    activeTeamId: uuid(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId)],
);

export const accounts = pgTable(
  'accounts',
  {
    id: id(),
    accountId: text().notNull(),
    providerId: text().notNull(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text(),
    refreshToken: text(),
    idToken: text(),
    accessTokenExpiresAt: at(),
    refreshTokenExpiresAt: at(),
    scope: text(),
    password: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.userId), uniqueIndex().on(t.providerId, t.accountId)],
);

export const verifications = pgTable(
  'verifications',
  {
    id: id(),
    identifier: text().notNull(),
    value: text().notNull(),
    expiresAt: at().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index().on(t.identifier)],
);

export const rateLimits = pgTable('rate_limits', {
  id: id(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: 'number' }).notNull(),
});

/** The tenant. Every tenant-owned table points here. */
export const organizations = pgTable('organizations', {
  id: id(),
  name: text().notNull(),
  slug: text().notNull().unique(),
  logo: text(),
  metadata: text(),
  createdAt: createdAt(),
});

export const members = pgTable(
  'members',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text().notNull().default('member'),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.organizationId, t.id),
    uniqueIndex().on(t.organizationId, t.userId),
    index().on(t.userId),
  ],
);

export const invitations = pgTable(
  'invitations',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    email: text().notNull(),
    role: text(),
    teamId: uuid(),
    status: text().notNull().default('pending'),
    expiresAt: at().notNull(),
    inviterId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.organizationId, t.id), index().on(t.organizationId), index().on(t.email)],
);

export const teams = pgTable(
  'teams',
  {
    id: id(),
    organizationId: uuid()
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    memberCount: integer().notNull().default(0),
    createdAt: createdAt(),
    updatedAt: at().$onUpdate(() => new Date()),
  },
  (t) => [unique().on(t.organizationId, t.id), index().on(t.organizationId)],
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: id(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    membershipKey: text().unique(),
    createdAt: at(),
  },
  (t) => [index().on(t.teamId), index().on(t.userId)],
);

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  members: many(members),
  teamMembers: many(teamMembers),
  invitations: many(invitations),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  invitations: many(invitations),
  teams: many(teams),
}));

export const membersRelations = relations(members, ({ one }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [members.userId], references: [users.id] }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  user: one(users, { fields: [invitations.inviterId], references: [users.id] }),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [teams.organizationId],
    references: [organizations.id],
  }),
  teamMembers: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, { fields: [teamMembers.teamId], references: [teams.id] }),
  user: one(users, { fields: [teamMembers.userId], references: [users.id] }),
}));
