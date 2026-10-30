import type { Database } from '@teamflow/db';
import { newId } from '@teamflow/db';
import * as schema from '@teamflow/db/schema';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { emailOTP, organization } from 'better-auth/plugins';
import { ac, roles } from './permissions.ts';

/** Emails Better Auth asks us to send. Delivery is the caller's job (queued, never inline in a request). */
export type AuthEmail =
  | { kind: 'verify-email'; to: string; code: string }
  | { kind: 'sign-in-code'; to: string; code: string }
  | { kind: 'reset-password'; to: string; code: string }
  | {
      kind: 'invitation';
      to: string;
      invitationId: string;
      organizationName: string;
      inviterName: string;
      role: string;
    };

export interface AuthOptions {
  db: Database;
  secret: string;
  /** Public URL of the api, e.g. `http://localhost:4000`. */
  baseURL: string;
  /** Origins allowed to call the auth routes with credentials (the web app). */
  trustedOrigins: string[];
  github?: { clientId: string; clientSecret: string } | undefined;
  sendEmail: (email: AuthEmail) => Promise<void>;
  /** Called once per new organization, inside the request that created it. */
  onOrganizationCreated?: (organizationId: string, ownerMemberId: string) => Promise<void>;
  /** Disable rate limiting (tests). */
  rateLimit?: boolean;
}

/**
 * The only header the rate limiter reads a client address from. The API server sets it from the socket's peer
 * address on every request and overwrites anything a client sent, so `X-Forwarded-For` cannot be forged to get a
 * fresh rate-limit bucket per attempt. (Behind a reverse proxy, the server would set it from the proxy's header.)
 */
export const CLIENT_IP_HEADER = 'x-teamflow-client-ip';

/** Endpoints that set a member's role. TeamFlow gives each member exactly one. */
const ROLE_PATHS = new Set([
  '/organization/invite-member',
  '/organization/update-member-role',
  '/organization/add-member',
]);

/**
 * Better Auth accepts a list of roles and stores it comma-separated, but TeamFlow's permissions (and the API's role
 * check) assume one: "guest,admin" would be an admin to Better Auth and a guest everywhere else. Refuse it.
 */
const singleRole = createAuthMiddleware(async (ctx) => {
  if (!ROLE_PATHS.has(ctx.path)) return;
  const role = (ctx.body as { role?: unknown } | undefined)?.role;
  const many = Array.isArray(role)
    ? role.length !== 1
    : typeof role === 'string' && role.includes(',');
  if (many) throw new APIError('BAD_REQUEST', { message: 'A member has exactly one role.' });
});

export function createAuth(options: AuthOptions) {
  return betterAuth({
    appName: 'TeamFlow',
    secret: options.secret,
    baseURL: options.baseURL,
    basePath: '/api/auth',
    trustedOrigins: options.trustedOrigins,
    telemetry: { enabled: false },
    database: drizzleAdapter(options.db, { provider: 'pg', schema, usePlural: true }),
    advanced: {
      database: { generateId: () => newId() },
      cookiePrefix: 'teamflow',
      ipAddress: { ipAddressHeaders: [CLIENT_IP_HEADER] },
    },
    rateLimit: { enabled: options.rateLimit ?? true, storage: 'database' },
    hooks: { before: singleRole },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // No cookie cache: every request already reads membership from Postgres, and a cached session would keep a
      // revoked device signed in until the cache expired.
      cookieCache: { enabled: false },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 10,
      maxPasswordLength: 128,
      // A reset is what someone does when they fear their account is taken: end every session it had.
      revokeSessionsOnPasswordReset: true,
    },
    emailVerification: {
      autoSignInAfterVerification: true,
    },
    ...(options.github
      ? {
          socialProviders: {
            github: {
              clientId: options.github.clientId,
              clientSecret: options.github.clientSecret,
            },
          },
        }
      : {}),
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        otpLength: 6,
        expiresIn: 10 * 60,
        async sendVerificationOTP({ email, otp, type }) {
          const kind =
            type === 'email-verification'
              ? 'verify-email'
              : type === 'sign-in'
                ? 'sign-in-code'
                : 'reset-password';
          await options.sendEmail({ kind, to: email, code: otp });
        },
      }),
      organization({
        ac,
        roles,
        creatorRole: 'owner',
        invitationExpiresIn: 7 * 24 * 60 * 60,
        cancelPendingInvitationsOnReInvite: true,
        teams: { enabled: true, allowRemovingAllTeams: true },
        async sendInvitationEmail(data) {
          await options.sendEmail({
            kind: 'invitation',
            to: data.email,
            invitationId: data.id,
            organizationName: data.organization.name,
            inviterName: data.inviter.user.name,
            role: data.role,
          });
        },
        organizationHooks: {
          async afterCreateOrganization({ organization: org, member }) {
            await options.onOrganizationCreated?.(org.id, member.id);
          },
        },
      }),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
export type Session = Auth['$Infer']['Session'];
