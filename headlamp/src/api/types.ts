import { createApiRef } from '@backstage/core-plugin-api';

export interface HeadlampApi {
  getBaseUrl(): Promise<string>;
  startServer(auth: {[key: string]: string}): Promise<void>;
  refreshKubeconfig(auth: {[key: string]: string}): Promise<void>;
  health(): Promise<{ status: string }>;
}

export const headlampApiRef = createApiRef<HeadlampApi>({
  id: 'plugin.headlamp.service',
});