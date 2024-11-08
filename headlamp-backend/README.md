# Headlamp Backend Plugin

The Headlamp Backend plugin provides endpoints for 
starting the headlamp server binary with the kubernetes context specified in the `app-config.yaml` file. It also provides an endpoint for refreshing the kubeconfig file used by the headlamp server.


## Configuration

The Headlamp Backend plugin is configured by setting the `headlampBackend.binaryPath` in the `app-config.yaml` file. For example:


### 1. Install the plugin
```bash
yarn --cwd packages/backend add @headlamp-k8s/backstage-plugin-headlamp-backend
```

### 2. Configure app-config.yaml
```yaml
headlampBackend:
  binaryPath: /path/to/headlamp/binary
```

### 3. Add backend plugin to `packages/backend/src/index.ts`

```
...
backend.add(import('@headlamp-k8s/backstage-plugin-headlamp-backend'));
```
