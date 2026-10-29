import { os, tenant } from '../orpc.ts';
import { auditService } from '../services/audit.ts';

export const audit = {
  list: os.audit.list
    .use(tenant)
    .handler(({ context, input }) => auditService.list(context, input)),
};
