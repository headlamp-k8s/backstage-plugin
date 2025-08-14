import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { HeadlampApi } from './types';
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-common';


export class HeadlampClient implements HeadlampApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async getBaseUrl() {
    return await this.discoveryApi.getBaseUrl('headlamp');
  }

  async fetchKubeconfig(auth: KubernetesRequestAuth): Promise<{ kubeconfig: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/fetchKubeconfig`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        auth: auth,
      }),
    });
    const data = await response.json();
    return { kubeconfig: data.kubeconfig };
  }

  async health(): Promise<{ status: string; serverRunning: boolean }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/health`);
    return await response.json();
  }
}