import { createApiRef } from '@backstage/core-plugin-api';
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-common';

export interface HeadlampApi {
  startServer(auth: KubernetesRequestAuth): Promise<void>;
  refreshKubeconfig(auth: KubernetesRequestAuth): Promise<void>;
  health(): Promise<{ status: string }>;
}

export const headlampApiRef = createApiRef<HeadlampApi>({
  id: 'plugin.headlamp.service',
});
