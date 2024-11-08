import fs from 'fs';
import { BackstageCredentials } from '@backstage/backend-plugin-api';
import { HeadlampKubernetesBuilder } from './headlamp';
import yaml from 'js-yaml';

/**
 * Represents a cluster configuration in a kubeconfig file
 * @interface KubeconfigCluster
 * @property {string} name - The unique name identifier for the cluster
 * @property {object} cluster - The cluster configuration details
 * @property {string} cluster.server - The URL/address of the Kubernetes API server
 * @property {boolean} [cluster.insecure-skip-tls-verify] - Whether to skip TLS certificate verification
 * @property {string} [cluster.certificate-authority-data] - The certificate authority data in base64 format
 * @property {string} [cluster.certificate-authority] - Path to the certificate authority file
 */
interface KubeconfigCluster {
    name: string;
    cluster: {
      server: string;
      'insecure-skip-tls-verify'?: boolean;
      'certificate-authority-data'?: string;
      'certificate-authority'?: string;
    };
  }
  
  /**
   * Represents a user configuration in a kubeconfig file
   * @interface KubeconfigUser
   * @property {string} name - The unique name identifier for the user
   * @property {object} user - The user authentication details
   * @property {string} [user.client-certificate-data] - The client certificate data in base64 format
   * @property {string} [user.client-key-data] - The client key data in base64 format
   * @property {string} [user.token] - The bearer token for authentication
   * @property {object} [user.exec] - Configuration for executable-based authentication
   * @property {string} user.exec.apiVersion - API version for the exec configuration
   * @property {string} user.exec.command - The command to execute
   * @property {string[]} user.exec.args - Arguments to pass to the command
   */
  interface KubeconfigUser {
    name: string;
    user: {
      'client-certificate-data'?: string;
      'client-key-data'?: string;
      token?: string;
      exec?: {
        apiVersion: string;
        command: string;
        args: string[];
      };
    };
  }
  
  /**
   * Represents a context configuration in a kubeconfig file
   * @interface KubeconfigContext
   * @property {string} name - The unique name identifier for the context
   * @property {object} context - The context configuration details
   * @property {string} context.cluster - Name of the cluster for this context
   * @property {string} context.user - Name of the user for this context
   */
  interface KubeconfigContext {
    name: string;
    context: {
      cluster: string;
      user: string;
    };
  }
  
  /**
   * Represents the full kubeconfig file structure
   * @interface Kubeconfig
   * @property {string} apiVersion - The API version of the kubeconfig file
   * @property {string} kind - The type of the configuration (should be "Config")
   * @property {KubeconfigCluster[]} clusters - Array of cluster configurations
   * @property {KubeconfigUser[]} users - Array of user configurations
   * @property {KubeconfigContext[]} contexts - Array of context configurations
   * @property {string} [current-context] - The name of the current active context
   */
  export interface Kubeconfig {
    apiVersion: string;
    kind: string;
    clusters: KubeconfigCluster[];
    users: KubeconfigUser[];
    contexts: KubeconfigContext[];
    'current-context'?: string;
  }
  
  /**
   * Combines multiple kubeconfig files into a single kubeconfig file
   * @param {Kubeconfig[]} kubeconfigs - Array of kubeconfig objects to combine
   * @returns {string} - The combined kubeconfig file as a string
   */
  export function combineKubeconfigs(kubeconfigs: Kubeconfig[]): string {
    const combinedConfig: Kubeconfig = {
      apiVersion: 'v1',
      kind: 'Config',
      clusters: [],
      users: [],
      contexts: [],
    };
  
    kubeconfigs.forEach(config => {
      combinedConfig.clusters.push(...config.clusters);
      combinedConfig.users.push(...config.users);
      combinedConfig.contexts.push(...config.contexts);
    });
  
    // Set the current-context to the first context if available
    if (combinedConfig.contexts.length > 0) {
      combinedConfig['current-context'] = combinedConfig.contexts[0].name;
    }
  
    return yaml.dump(combinedConfig, {
      lineWidth: -1, // Disable line wrapping
      noRefs: true, // Avoid aliases for repeated nodes
      quotingType: '"', // Use double quotes for strings
    });
  }

/**
 * Writes a kubeconfig file to the specified path using the provided config and kubernetes builder
 * @param config - The Backstage config object
 * @param kubernetesBuilder - The HeadlampKubernetesBuilder instance used to generate the kubeconfig
 * @param filePath - The file path where the kubeconfig should be written
 */
export async function writeKubeconfig(
    credentials: BackstageCredentials,
    kubernetesBuilder: HeadlampKubernetesBuilder,
    filePath: string,
  ) {
    const kubeconfig = await kubernetesBuilder.getKubeconfig(credentials);
  
    fs.writeFileSync(filePath, kubeconfig);
  }
  