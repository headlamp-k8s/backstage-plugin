import { createApiRef } from '@backstage/core-plugin-api';

export interface HeadlampApi {
  startServer(): Promise<void>;
  refreshKubeconfig(): Promise<void>;
  health(): Promise<{ status: string }>;
}

export const headlampApiRef = createApiRef<HeadlampApi>({
  id: 'plugin.headlamp.service',
});