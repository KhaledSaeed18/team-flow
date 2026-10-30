import { OpenAPIGenerator } from '@orpc/openapi';
import { ZodToJsonSchemaConverter } from '@orpc/zod/zod4';
import { contract } from '@teamflow/contract';

const generator = new OpenAPIGenerator({ schemaConverters: [new ZodToJsonSchemaConverter()] });

export function generateOpenApi(serverUrl: string) {
  return generator.generate(contract, {
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
