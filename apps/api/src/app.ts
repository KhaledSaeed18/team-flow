import { OpenAPIHandler } from '@orpc/openapi/fetch';
import { onError } from '@orpc/server';
import { RPCHandler } from '@orpc/server/fetch';
import { ping } from '@teamflow/db';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';
import type { Deps, RequestContext } from './context.ts';
import { generateOpenApi, referencePage } from './openapi.ts';
import { router } from './routers/index.ts';
import { uploadAttachment } from './upload.ts';

export interface AppOptions {
  apiUrl: string;
  webUrl: string;
}

type Env = { Variables: { requestId: string } };

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

  app.on(['GET', 'POST'], '/api/auth/*', (c) => deps.auth.handler(c.req.raw));

  const spec = generateOpenApi(options.apiUrl);
  app.get('/api/openapi.json', async (c) => c.json(await spec));
  app.get('/api/docs', (c) => c.html(referencePage('/api/openapi.json')));

  app.post('/api/tasks/:taskId/attachments', uploadAttachment(deps));

  const context = async (headers: Headers, id: string): Promise<RequestContext> => ({
    ...deps,
    requestId: id,
    headers,
    session: await deps.auth.api.getSession({ headers }),
  });

  app.use('/rpc/*', async (c, next) => {
    const { matched, response } = await rpc.handle(c.req.raw, {
      prefix: '/rpc',
      context: await context(c.req.raw.headers, c.get('requestId')),
    });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });

  app.use('/api/v1/*', async (c, next) => {
    const { matched, response } = await rest.handle(c.req.raw, {
      prefix: '/api/v1',
      context: await context(c.req.raw.headers, c.get('requestId')),
    });
    if (matched) return c.newResponse(response.body, response);
    await next();
  });

  app.notFound((c) => c.json({ code: 'NOT_FOUND', message: 'Not found.' }, 404));
  app.onError((error, c) => {
    logger.error({ err: error, requestId: c.get('requestId') }, 'unhandled error');
    return c.json({ code: 'INTERNAL_SERVER_ERROR', message: 'Something went wrong.' }, 500);
  });

  return app;
}
