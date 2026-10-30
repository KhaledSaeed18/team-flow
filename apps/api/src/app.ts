import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { ping } from '@teamflow/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import { auditedAuthHandler } from './auth-audit.ts';
import type { Deps, RequestContext } from './context.ts';
import { generateOpenApi, referencePage } from './openapi.ts';
import { router } from './routers/index.ts';
import { authenticateToken } from './tokens.ts';
import { uploadAttachment } from './upload.ts';

export interface AppOptions {
  apiUrl: string;
  webUrl: string;
  /** Someone's access may have ended (a member removed, a session revoked): re-check open sockets now. */
  onAccessChanged?: () => void;
}

const ACCESS_RECHECK_DELAY_MS = 1_000;

/** Auth endpoints after which an open socket may no longer be entitled to what it receives. */
const ACCESS_PATHS = new Set([
  '/organization/remove-member',
  '/organization/leave',
  '/organization/update-member-role',
  '/organization/delete',
  '/revoke-session',
  '/revoke-sessions',
  '/revoke-other-sessions',
  '/sign-out',
  '/change-password',
  '/reset-password',
  '/email-otp/reset-password',
]);

type Env = { Variables: { requestId: string } };

/** The same error shape oRPC sends, so every API error reads alike whichever layer refused the request. */
const errorBody = (code: string, status: number, message: string, defined = true) => ({
  defined,
  code,
  status,
  message,
});

export function createApp(deps: Deps, options: AppOptions) {
  const app = new Hono<Env>();
  const { logger } = deps;

  const reportError = (error: unknown) => {
    const status = (error as { status?: number }).status ?? 500;
    if (status >= 500) logger.error({ err: error }, 'procedure failed');
  };
  const rpc = new RPCHandler(router, { interceptors: [onError(reportError)] });
  const rest = new OpenAPIHandler(router, { interceptors: [onError(reportError)] });

  app.use(requestId());
  app.use(async (c, next) => {
    const started = performance.now();
    await next();
    logger.info(
      {
        requestId: c.get('requestId'),
        method: c.req.method,
        path: c.req.path,
        status: c.res.status,
        ms: Math.round(performance.now() - started),
      },
      'request',
    );
  });
  app.use(secureHeaders());
  app.use(
    '/api/*',
    cors({
      origin: options.webUrl,
      credentials: true,
      allowHeaders: ['content-type'],
      maxAge: 600,
    }),
  );
  app.use(
    '/rpc/*',
    cors({
      origin: options.webUrl,
      credentials: true,
      allowHeaders: ['content-type'],
      maxAge: 600,
    }),
  );

  app.get('/health', (c) => c.json({ status: 'ok' }));
  app.get('/ready', async (c) => {
    try {
      await ping(deps.db);
      return c.json({ status: 'ready' });
    } catch (error) {
      logger.warn({ err: error }, 'readiness check failed');
      return c.json({ status: 'unavailable' }, 503);
    }
  });

  const authHandler = auditedAuthHandler(deps);
  app.on(['GET', 'POST'], '/api/auth/*', async (c) => {
    const response = await authHandler(c.req.raw);
    const path = c.req.path.replace(/^\/api\/auth/, '');
    // After the response: the caller's own new session cookie (password change) must reach their browser before
    // its sockets are re-checked, or the re-check would cut off the very device that made the change.
    if (c.req.method === 'POST' && response.ok && ACCESS_PATHS.has(path)) {
      setTimeout(() => options.onAccessChanged?.(), ACCESS_RECHECK_DELAY_MS);
    }
    return response;
  });

  const spec = generateOpenApi(options.apiUrl);
  app.get('/api/openapi.json', async (c) => c.json(await spec));
  app.get('/api/docs', (c) => c.html(referencePage('/api/openapi.json')));

  app.post('/api/tasks/:taskId/attachments', uploadAttachment(deps));

  const context = async (headers: Headers, id: string): Promise<RequestContext> => ({
    ...deps,
    requestId: id,
    headers,
    session: await deps.auth.api.getSession({ headers }),
    token: null,
  });

  app.use('/rpc/*', async (c, next) => {
    const { matched, response } = await rpc.handle(c.req.raw, {
      prefix: '/rpc',
      context: await context(c.req.raw.headers, c.get('requestId')),
    });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });

  // The public API also takes personal access tokens. The SPA's `/rpc` stays cookie-only.
  app.use('/api/v1/*', async (c, next) => {
    const auth = await authenticateToken(deps, c.req.raw.headers);
    if (auth.kind === 'invalid') {
      return c.json(
        errorBody('UNAUTHORIZED', 401, 'This token is invalid, expired or revoked.'),
        401,
      );
    }
    if (
      auth.kind === 'ok' &&
      auth.grant.access === 'read' &&
      !['GET', 'HEAD'].includes(c.req.method)
    ) {
      return c.json(errorBody('FORBIDDEN', 403, 'This token is read-only.'), 403);
    }
    const base = await context(c.req.raw.headers, c.get('requestId'));
    const { matched, response } = await rest.handle(c.req.raw, {
      prefix: '/api/v1',
      context: auth.kind === 'ok' ? { ...base, session: auth.session, token: auth.grant } : base,
    });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });

  app.notFound((c) => c.json(errorBody('NOT_FOUND', 404, 'Not found.'), 404));
  app.onError((error, c) => {
    logger.error({ err: error, requestId: c.get('requestId') }, 'unhandled error');
    return c.json(errorBody('INTERNAL_SERVER_ERROR', 500, 'Something went wrong.', false), 500);
  });

  return app;
}
