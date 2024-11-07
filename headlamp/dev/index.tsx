import React from 'react';
import { createDevApp } from '@backstage/dev-utils';
import { headlampPlugin, HeadlampPage } from '../src/plugin';

createDevApp()
  .registerPlugin(headlampPlugin)
  .addPage({
    element: <HeadlampPage />,
    title: 'Headlamp Page',
    path: '/headlamp',
  })
  .render();
