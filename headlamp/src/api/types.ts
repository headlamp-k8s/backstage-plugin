import { createApiRef } from '@backstage/core-plugin-api';
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-common';


export interface HeadlampApi {
  getBaseUrl(): Promise<string>;
  fetchKubeconfig(auth: KubernetesRequestAuth): Promise<{ kubeconfig: string }>;
  health(): Promise<{ status: string , serverRunning: boolean}>;
}

export const headlampApiRef = createApiRef<HeadlampApi>({
  id: 'plugin.headlamp.service',
});