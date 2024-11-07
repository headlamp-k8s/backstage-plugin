import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';
import { createApiFactory } from '@backstage/core-plugin-api';
import { headlampApiRef } from './api/types';
import { HeadlampClient } from './api/HeadlampClient';
import { discoveryApiRef, fetchApiRef } from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const headlampPlugin = createPlugin({
  id: 'headlamp',
  apis: [createApiFactory({
    api: headlampApiRef,
    deps: { discoveryApi: discoveryApiRef, fetchApi: fetchApiRef },
    factory: ({ discoveryApi, fetchApi }) => new HeadlampClient({ discoveryApi, fetchApi }),
  })],
  routes: {
    root: rootRouteRef,
  },
});

export const HeadlampPage = headlampPlugin.provide(
  createRoutableExtension({
    name: 'HeadlampPage',
    component: () =>
      import('./components/HeadlampComponent').then(m => m.HeadlampComponent),
    mountPoint: rootRouteRef,
  }),
);
