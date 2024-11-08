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




# backstage-plugin-headlamp-app-*

These packages provide architecture-specific headlamp-server+frontend embedded binaries.

These are added to optionalDependencies in package.json.

## Installation

```sh
# Install yarn 1 if you don't have it https://classic.yarnpkg.com/en/docs/install
npm install --global yarn

# Download headlamp repo, checkout backstage branch, and build headlamp-servers for the different platforms
cd headlamp-backend
yarn build-headlamps
```

## Releasing the backstage-plugin-headlamp-app-* packages

For the backstage-plugin-headlamp-app-* packages, use the normal `npm pack` to generate the tar ball which is then `npm publish backstage-plugin-headlamp-app-darwin-arm64-0.1.0.tgz` (using the alpha tag perhaps for alpha releases).

### Scripts

This package includes several scripts to help with building, testing, and managing dependencies. Below is a description of each script:

#### `build-headlamps`
This script clones the Headlamp repository, checks out the `backstage` branch, runs `make backend-embed` to build the binaries, and copies the resulting binaries into the appropriate `bin/` folders within the project.

```sh
npm run build-headlamps
```

#### `postinstall`
This script runs automatically after the package is installed. It detects the current platform and architecture, then copies the appropriate binary from the optional dependencies to the root of the package.

#### `update-package-json-testing`
This script updates the `package.json` to use local file paths for the optional dependencies, enabling testing with local versions of the packages.

```sh
npm run update-package-json-testing
```

#### `update-package-json-non-testing`
This script updates the `package.json` to use the actual versions of the optional dependencies from their respective `package.json` files, restoring the non-testing configuration.

```sh
npm run update-package-json-non-testing
```

#### `test-and-validate`
This script automates the process of building the binaries, linking the packages, updating the `package.json` for testing, installing dependencies, and validating the presence of the correct binary for the platform. It ensures that the `headlamp-server` (or `headlamp-server.exe` on Windows) is present and correctly built for the current platform.

```sh
npm run test-and-validate
```

### Usage

To run these scripts, use the following commands:

- **Build Headlamps**: `npm run build-headlamps`
- **Post Install**: This script runs automatically after installation.
- **Update for Testing**: `npm run update-package-json-testing`
- **Restore Non-Testing**: `npm run update-package-json-non-testing`
- **Test and Validate**: `npm run test-and-validate`


## Testing backstage-plugin-headlamp-app-

How to test locally without releasing them all.


First build the different binaries.
```
cd headlamp-backend
yarn build-headlamps
cd ..
```

Then link all the packages.
```
cd packages/backstage-plugin-headlamp-app-darwin-arm64/
yarn link
cd ../backstage-plugin-headlamp-app-linux-x64-gnu/
yarn link
cd ../backstage-plugin-headlamp-app-win32-x64-msvc/
yarn link


cd ../headlamp-backend
yarn link @headlamp-k8s/backstage-plugin-headlamp-app-darwin-arm64
yarn link @headlamp-k8s/backstage-plugin-headlamp-app-linux-x64-gnu
yarn link @headlamp-k8s/backstage-plugin-headlamp-app-win32-x64-msvc

# if you need to unlink sometime... otherwise ignore these.
# yarn unlink @headlamp-k8s/backstage-plugin-headlamp-app-darwin-arm64
# yarn unlink @headlamp-k8s/backstage-plugin-headlamp-app-linux-x64-gnu
# yarn unlink @headlamp-k8s/backstage-plugin-headlamp-app-win32-x64-msvc
```

Now change package.json optionalDependencies fields in headlamp-backend.

```
npm run update-package-json-testing
```

To restore them later to the non-testing state do...
```
npm run update-package-json-non-testing
```

Then validate it copies the right file.

```
cd headlamp-backend
yarn install
ls -la headlamp-server
file headlamp-server
```

You should see the headlamp-server (or headlamp-server.exe on windows) into the headlamp-backend folder.
