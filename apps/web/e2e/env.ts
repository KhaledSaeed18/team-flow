/** Ports and URLs for the end-to-end stack, kept apart from the development servers. */
export const E2E = {
  databaseUrl:
    process.env.E2E_DATABASE_URL ?? 'postgres://teamflow:teamflow@localhost:5442/teamflow_e2e',
  apiPort: 4100,
  webPort: 5174,
  demo: { email: 'demo@teamflow.dev', password: 'teamflow-demo' },
  maya: { email: 'maya@northwind.test', password: 'teamflow-demo' },
};
