# Headlamp Plugin (beta)

The Headlamp plugin for Backstage embeds the Headlamp UI within your Backstage instance using an iframe. The plugin can be used in two modes:

1. **Standalone Mode**: 
   - Simply displays an existing Headlamp instance using the URL configured in `app-config.yaml`
   - Requires only configuring the `headlamp.url` parameter

2. **Backend Integration Mode**:
   - Works in conjunction with the headlamp-backend plugin
   - Automatically starts a Headlamp server instance
   - Uses the Kubernetes context specified in your `app-config.yaml` for interoperability with the backstage kubernetes plugin
   - Provides a more integrated experience within Backstage

## Configuration

The Headlamp plugin is configured by setting the `headlamp.url` in the `app-config.yaml` file.

### 1. Install the plugin
```bash
yarn --cwd packages/app add @headlamp-k8s/backstage-plugin-headlamp
```

### 2. Add Headlamp route to `packages/app/src/App.tsx`

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

### 3. Add Headlamp to the Sidebar

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

### 4. Configure Headlamp url (Optional)

If you are deploying the Headlamp backend plugin ie using the backend integration mode, you can configure the url of the Headlamp instance by setting the `headlamp.url` parameter in the `app-config.yaml` file.

example:
```yaml
headlamp:
  url: https://headlamp.example.com
```