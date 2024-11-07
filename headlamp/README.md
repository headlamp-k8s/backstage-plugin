# Headlamp Plugin

The Headlamp plugin for Backstage displays headlamp UI, it will display the headlamp URL that is configured in the `app-config.yaml` file using an iframe.


## Configuration

The Headlamp plugin is configured by setting the `headlamp.url` in the `app-config.yaml` file.

### 1. Install the plugin
```bash
yarn --cwd packages/app add @headlamp-k8s/backstage-plugin-headlamp
```

### 2. Configure app-config.yaml
```yaml
headlamp:
  url: https://headlamp.com
```

### 3. Add Headlamp route to `packages/app/src/App.tsx`

Add the following import
```tsx
import { HeadlampPage } from '@headlamp-k8s/backstage-plugin-headlamp';
```

Add the following route to the const routes
```tsx
const routes = [
    <FlatRoutes>
    ...
    <Route path="/headlamp" element={<HeadlampPage />} />
    </FlatRoutes>
]
```

### 4. Add Headlamp to the Sidebar

Add the following import to `packages/app/src/components/Root/Root.tsx`

```tsx
import { HeadlampIcon } from '@headlamp-k8s/backstage-plugin-headlamp';  
```

Add the SidebarItem within any SidebarGroup in your Root component:

```tsx
export const Root = ({ children }: PropsWithChildren<{}>) => (
  <SidebarPage>
    <Sidebar>
        <SidebarItem icon={HeadlampIcon} to="headlamp" text="Headlamp" />
        {/* ... other items ... */}
    </Sidebar>
    {children}
  </SidebarPage>
);
```
