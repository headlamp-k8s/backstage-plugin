import { createApiRef } from '@backstage/core-plugin-api';

export interface HeadlampApi {
  getBaseUrl(): Promise<string>;
  // startServer(auth: {[key: string]: string}): Promise<void>;
  // refreshKubeconfig(auth: {[key: string]: string}): Promise<void>;
  fetchKubeconfig(auth: {[key: string]: string}): Promise<{ kubeconfig: string }>;
  health(): Promise<{ status: string , serverRunning: boolean}>;
}

export const headlampApiRef = createApiRef<HeadlampApi>({
  id: 'plugin.headlamp.service',
});