import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { HeadlampApi } from './types';

export class HeadlampClient implements HeadlampApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl() {
    return await this.discoveryApi.getBaseUrl('headlamp');
  }

  async startServer(): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    await this.fetchApi.fetch(`${baseUrl}/start`, {
      method: 'POST',
    });
  }

  async refreshKubeconfig(): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    await this.fetchApi.fetch(`${baseUrl}/refreshKubeconfig`, {
      method: 'POST',
    });
  }

  async health(): Promise<{ status: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/health`);
    return await response.json();
  }
}