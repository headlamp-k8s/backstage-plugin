import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import os from 'os';
import { createRouter } from './service/router';
import path from 'path';
import { catalogServiceRef } from '@backstage/plugin-catalog-node/alpha';
import { HeadlampKubernetesBuilder } from './headlamp';


/**
 * headlampPlugin backend plugin
 *
 * @public
 */
export const headlampPlugin = createBackendPlugin({
  pluginId: 'headlamp',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
        discovery: coreServices.discovery,
        catalogApi: catalogServiceRef,
        permissions: coreServices.permissions,
        auth: coreServices.auth,
        httpAuth: coreServices.httpAuth,
      },

      async init({ httpRouter, logger, config, discovery, catalogApi, permissions, auth, httpAuth }) {
        
        
        
        const kubeconfigPath = path.join(os.tmpdir(), 'kubeconfig.yaml');
        const headlampBinaryPath = config.getString('headlampBackend.binaryPath');

        logger.info(`Headlamp Binary Path: ${headlampBinaryPath}`);
        logger.info(`Kubeconfig Path: ${kubeconfigPath}`);
        const builder: HeadlampKubernetesBuilder = new HeadlampKubernetesBuilder({
          logger,
          config,
          discovery,
          catalogApi,
          permissions,
          auth,
          httpAuth,
        });

        httpRouter.use(
          await createRouter({
            logger,
            config,
            kubernetesBuilder: builder,
            httpAuth,
            kubeconfigPath,
            headlampBinaryPath,
          }),
        );
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
