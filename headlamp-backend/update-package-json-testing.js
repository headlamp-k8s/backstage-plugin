// This script updates the package.json to use local file paths for the optional dependencies,
// enabling testing with local versions of the packages.

const fs = require('fs');
const path = require('path');

// Define the path to the package.json file
const packageJsonPath = path.join(__dirname, 'package.json');

// Load the existing package.json content
let packageJson;
try {
  packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
} catch (error) {
  console.error(`Failed to read ${packageJsonPath}:`, error.message);
  process.exit(1);
}

// Update the optionalDependencies for testing
packageJson.optionalDependencies = {
  "@headlamp-k8s/backstage-plugin-headlamp-app-darwin-arm64": "file:../packages/backstage-plugin-headlamp-app-darwin-arm64",
  "@headlamp-k8s/backstage-plugin-headlamp-app-linux-x64-gnu": "file:../packages/backstage-plugin-headlamp-app-linux-x64-gnu",
  "@headlamp-k8s/backstage-plugin-headlamp-app-win32-x64-msvc": "file:../packages/backstage-plugin-headlamp-app-win32-x64-msvc"
};

// Save the updated package.json content
try {
  fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2), 'utf8');
  console.log(`Updated ${packageJsonPath} with testing optionalDependencies.`);
} catch (error) {
  console.error(`Failed to write ${packageJsonPath}:`, error.message);
  process.exit(1);
}
