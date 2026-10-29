import { ac, roles } from '@teamflow/auth/permissions';
import { emailOTPClient, organizationClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  basePath: '/api/auth',
  plugins: [organizationClient({ ac, roles, teams: { enabled: true } }), emailOTPClient()],
});
