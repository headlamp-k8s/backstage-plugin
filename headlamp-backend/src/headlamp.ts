import { KubernetesBuilder } from '@backstage/plugin-kubernetes-backend';
import { Duration } from 'luxon';
import { AuthMetadata } from '@backstage/plugin-kubernetes-node';
import {
  ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER,
  ANNOTATION_KUBERNETES_AUTH_PROVIDER,
} from '@backstage/plugin-kubernetes-common';
import { KubernetesRequestAuth } from '@backstage/plugin-kubernetes-common';
import { KubernetesCredential } from '@backstage/plugin-kubernetes-node';
import { Kubeconfig,combineKubeconfigs } from './utils';
import { BackstageCredentials } from '@backstage/backend-plugin-api';


/**
 * HeadlampKubernetesBuilder extends KubernetesBuilder to provide functionality for generating kubeconfig files
 * and managing Kubernetes cluster details for Headlamp integration.
 * @extends KubernetesBuilder
 */
export class HeadlampKubernetesBuilder extends KubernetesBuilder {
  /**
   * Lists details for all configured Kubernetes clusters
   * @param {BackstageCredentials} credentials - The Backstage credentials for authentication
   * @returns {Promise<Array<{name: string, url: string, skipTLSVerify: boolean, credential: KubernetesCredential, caData: string}>>} 
   * Array of cluster details including connection info and credentials
   */
  public async listClusterDetails(credentials: BackstageCredentials,auth: KubernetesRequestAuth): Promise<
    Array<{
      name: string;
      url: string;
      skipTLSVerify: boolean;
      credential: KubernetesCredential;
      caData: string;
    }>
  > {
    const duration = Duration.fromObject({
      minutes: 1,
    });

    const clusterSupplier = this.buildClusterSupplier(duration);
    
    const clusterDetails = await clusterSupplier.getClusters({credentials});

    const clusterInfo = clusterDetails.map(async cd => {
      const oidcTokenProvider =
        cd.authMetadata[ANNOTATION_KUBERNETES_OIDC_TOKEN_PROVIDER];
      const authProvider = cd.authMetadata[ANNOTATION_KUBERNETES_AUTH_PROVIDER];

      const authStrategyMap = this.getAuthStrategyMap();

      const currentAuthStrategy = authStrategyMap[authProvider];

      const currentCredential = await currentAuthStrategy.getCredential(
        cd,
        auth,
      );

      return {
        name: cd.name,
        url: cd.url,
        skipTLSVerify: cd.skipTLSVerify ?? false,
        title: cd.title,
        caData: cd.caData,
        credential: currentCredential,
        authProvider,
        ...(oidcTokenProvider && { oidcTokenProvider }),
        ...(auth && Object.keys(auth).length !== 0 && { auth }),
      };
    });

    return Promise.all(clusterInfo).then(clusters =>
      clusters.map(cluster => ({
        name: cluster.name,
        url: cluster.url,
        skipTLSVerify: cluster.skipTLSVerify,
        credential: cluster.credential,
        caData: cluster.caData || '',
      })),
    );
  }

  /**
   * Converts a cluster details object into a kubeconfig format
   * @param {Object} cluster - The cluster details object
   * @param {string} cluster.name - Name of the cluster
   * @param {string} cluster.url - URL of the cluster API server
   * @param {boolean} cluster.skipTLSVerify - Whether to skip TLS verification
   * @param {KubernetesCredential} cluster.credential - Credentials for cluster authentication
   * @param {string} cluster.caData - Certificate authority data
   * @returns {Kubeconfig} Kubeconfig object for the cluster
   * @private
   */
  private convertClusterToKubeconfig(cluster: {
    name: string;
    url: string;
    skipTLSVerify: boolean;
    credential: KubernetesCredential;
    caData: string;
  }): Kubeconfig {
    const kubeconfig: Kubeconfig = {
      apiVersion: 'v1',
      kind: 'Config',
      clusters: [
        {
          name: cluster.name,
          cluster: {
            server: cluster.url,
            'insecure-skip-tls-verify': cluster.skipTLSVerify,
            'certificate-authority-data': cluster.caData,
          },
        },
      ],
      users: [
        {
          name: cluster.name,
          user: {},
        },
      ],
      contexts: [
        {
          name: cluster.name,
          context: {
            cluster: cluster.name,
            user: cluster.name,
          },
        },
      ],
      'current-context': cluster.name,
    };

    // Handle different credential types
    switch (cluster.credential.type) {
      case 'bearer token':
        kubeconfig.users[0].user.token = cluster.credential.token;
        break;
      case 'x509 client certificate':
        kubeconfig.users[0].user = {
          'client-certificate-data': cluster.credential.cert,
          'client-key-data': cluster.credential.key,
        };
        break;
      case 'anonymous':
        // No additional configuration needed for anonymous
        break;
      default:
        break;
    }

    return kubeconfig;
  }

  /**
   * Generates a complete kubeconfig file string for all configured clusters
   * @param {BackstageCredentials} credentials - The Backstage credentials for authentication
   * @returns {Promise<string>} Combined kubeconfig file contents as a string
   */
  public async getKubeconfig(credentials: BackstageCredentials,auth: KubernetesRequestAuth): Promise<string> {
    const clusters = await this.listClusterDetails(credentials,auth);

    const kubeconfigs = clusters.map(cluster =>
      this.convertClusterToKubeconfig(cluster),
    );

    return combineKubeconfigs(kubeconfigs);
  }
}
