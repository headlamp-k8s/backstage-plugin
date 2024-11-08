# Headlamp Backend Plugin (beta)

The Headlamp Backend plugin provides endpoints for 
starting the headlamp server binary with the kubernetes context specified in the `app-config.yaml` file. It also provides an endpoint for refreshing the kubeconfig file used by the headlamp server.

## Configuration

The Headlamp Backend plugin is configured by setting the `headlampBackend.binaryPath` in the `app-config.yaml` file. For example:

### 1. Install the plugin
```bash
yarn --cwd packages/backend add @headlamp-k8s/backstage-plugin-headlamp-backend
```

### 2. Add backend plugin to `packages/backend/src/index.ts`

```
...
backend.add(import('@headlamp-k8s/backstage-plugin-headlamp-backend'));
```

### 3. Configure Headlamp Backend (Optional)

If you want to use a custom headlamp binary or custom plugins you can set the `headlampBackend.binaryPath` and `headlampBackend.pluginsPath` parameters in the `app-config.yaml` file.

example:
```yaml
headlampBackend:
  binaryPath: /path/to/headlamp/binary
  pluginsPath: /path/to/headlamp/plugins
```
