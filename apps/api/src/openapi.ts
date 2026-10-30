import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { contract } from '@teamflow/contract';

const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });

export async function generateOpenApi(serverUrl: string) {
  const document = await generator.generate(contract, {
    info: {
      title: 'TeamFlow API',
      version: '2.0.0',
      description:
        'The public TeamFlow API. Every operation here is generated from the same contract the web app uses.',
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    security: [{ token: [] }, { session: [] }],
    components: {
      securitySchemes: {
        token: {
          type: 'http',
          scheme: 'bearer',
          description:
            'A personal access token (`tf_…`), created in Account settings. Read tokens may only make GET requests.',
        },
        session: { type: 'apiKey', in: 'cookie', name: 'teamflow.session_token' },
      },
    },
  });
  return polish(document);
}

type Json = Record<string, unknown>;
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Two things the generator gets wrong for readers. Zod integers carry the safe-integer range as their bounds, so a
 * positive version read "greater than 0, minimum -9007199254740991"; those default bounds are dropped. Error
 * responses are described only by their status ("409"); each now lists the errors it can carry and their messages.
 */
export function polish<T>(document: T): T {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isObject(node)) return;
    if (node.type === 'integer') {
      if (node.minimum === Number.MIN_SAFE_INTEGER) delete node.minimum;
      if (node.maximum === Number.MAX_SAFE_INTEGER) delete node.maximum;
    }
    for (const value of Object.values(node)) visit(value);
  };
  visit(document);

  const paths = isObject(document) && isObject(document.paths) ? document.paths : {};
  for (const operations of Object.values(paths)) {
    if (!isObject(operations)) continue;
    for (const operation of Object.values(operations)) {
      if (!isObject(operation) || !isObject(operation.responses)) continue;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (!isObject(response) || response.description !== status) continue;
        const described = errorsIn(response);
        if (described.length > 0) response.description = described.join(' ');
      }
    }
  }
  return document;
}

/** `CODE: message.` for each defined error in an error response's schema. */
function errorsIn(response: Json): string[] {
  const content = isObject(response.content) ? response.content['application/json'] : undefined;
  const schema = isObject(content) ? content.schema : undefined;
  const variants = isObject(schema) && Array.isArray(schema.oneOf) ? schema.oneOf : [];
  return variants.flatMap((variant) => {
    const properties = isObject(variant) && isObject(variant.properties) ? variant.properties : {};
    const code = isObject(properties.code) ? properties.code.const : undefined;
    const message = isObject(properties.message) ? properties.message.default : undefined;
    if (typeof code !== 'string') return [];
    return [typeof message === 'string' ? `\`${code}\`: ${message}` : `\`${code}\`.`];
  });
}

/** A self-contained API reference page (Scalar, loaded from its CDN). */
/** Scalar's hosted-product toolbar and assistant point at its cloud; a local reference has no use for them. */
const REFERENCE_CONFIG = {
  showToolbar: 'never',
  showDeveloperTools: 'never',
  agent: { disabled: true },
  hideClientButton: false,
  favicon: '/favicon.svg',
};

export const referencePage = (specUrl: string) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>TeamFlow API reference</title>
  </head>
  <body>
    <script
      id="api-reference"
      data-url="${specUrl}"
      data-configuration='${JSON.stringify(REFERENCE_CONFIG)}'
    ></script>
    <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
  </body>
</html>`;
