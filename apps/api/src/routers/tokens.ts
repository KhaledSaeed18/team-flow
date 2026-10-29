import { os, tenant } from '../orpc.ts';
import { tokensService } from '../services/tokens.ts';

export const tokens = {
  list: os.tokens.list.use(tenant).handler(({ context }) => tokensService.list(context)),
  create: os.tokens.create
    .use(tenant)
    .handler(({ context, input }) => tokensService.create(context, input, context.clock.now())),
  revoke: os.tokens.revoke
    .use(tenant)
    .handler(({ context, input }) => tokensService.revoke(context, input.id)),
};
